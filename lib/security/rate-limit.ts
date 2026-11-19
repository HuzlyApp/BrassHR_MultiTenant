import { clientIpFromHeaders } from "@/lib/auth/auth-failure-guard";
import "server-only";

import { Redis as UpstashRedis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { hashQueryParams } from "@/lib/cache-keys";

type RateLimitCount = { count: number; retryAfterSec: number };

type RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<RateLimitCount>;
};

type Bucket = { count: number; expiresAt: number };

export type RateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  failClosed?: boolean;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  store: "redis" | "memory";
};

const memoryBuckets = new Map<string, Bucket>();
let storePromise: Promise<RateLimitStore | null> | null = null;

/** Independent from cache circuit — a cache blip must not brick auth/tickets. */
const RATE_LIMIT_TIMEOUT_MS =
  Number(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS ?? process.env.CACHE_REDIS_TIMEOUT_MS ?? 8_000) ||
  8_000;
const RATE_LIMIT_COOLDOWN_MS =
  Number(process.env.RATE_LIMIT_REDIS_FAILURE_COOLDOWN_MS ?? 15_000) || 15_000;

type RateLimitCircuitState = { unavailableUntil: number };
const rateLimitCircuit: RateLimitCircuitState =
  ((globalThis as typeof globalThis & { __brassRateLimitRedisCircuit?: RateLimitCircuitState })
    .__brassRateLimitRedisCircuit ??= { unavailableUntil: 0 });

/**
 * One round-trip: INCR, ensure TTL, return {count, ttl}.
 * Avoids 3–4 sequential Redis calls that blow a single request timeout on remote Redis.
 */
const INCREMENT_LUA = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
if ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

function isRateLimitCircuitOpen(): boolean {
  return rateLimitCircuit.unavailableUntil > Date.now();
}

function markRateLimitRedisUnavailable(): void {
  rateLimitCircuit.unavailableUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

function withRateLimitTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const ms = RATE_LIMIT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`rate-limit redis timeout (${label}) after ${ms}ms`)),
        ms
      );
    }),
  ]);
}

function hashKey(value: string): string {
  return hashQueryParams(value);
}

function rateLimitKey(namespace: string, key: string): string {
  return `rate-limit:${namespace}:${hashKey(key)}`;
}

function getWindowSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function incrementMemory(key: string, windowMs: number): RateLimitCount {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return { count: 1, retryAfterSec: getMemoryRetryAfterSec(key) };
  }
  existing.count += 1;
  return { count: existing.count, retryAfterSec: getMemoryRetryAfterSec(key) };
}

function getMemoryRetryAfterSec(key: string): number {
  const bucket = memoryBuckets.get(key);
  if (!bucket) return 1;
  return Math.max(1, Math.ceil((bucket.expiresAt - Date.now()) / 1000));
}

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : fallback;
}

function parseIncrementResult(raw: unknown, windowSeconds: number): RateLimitCount {
  const pair = Array.isArray(raw) ? raw : null;
  const count = toPositiveInt(pair?.[0], 1);
  const ttl = Number(pair?.[1]);
  return {
    count,
    retryAfterSec:
      Number.isFinite(ttl) && ttl > 0 ? Math.ceil(ttl) : windowSeconds,
  };
}

function redisConfigured(): boolean {
  const url = process.env.REDIS_URL?.trim();
  return Boolean(url);
}

async function createUpstashStore(url: string, token: string): Promise<RateLimitStore> {
  const redis = new UpstashRedis({ url, token });
  return {
    increment: async (key, windowSeconds) => {
      const raw = await withRateLimitTimeout(
        redis.eval(INCREMENT_LUA, [key], [String(windowSeconds)]),
        "upstash-incr"
      );
      return parseIncrementResult(raw, windowSeconds);
    },
  };
}

async function createNodeRedisStore(url: string): Promise<RateLimitStore> {
  const { createClient } = await import("redis");
  const client = createClient({
    url,
    socket: {
      connectTimeout: RATE_LIMIT_TIMEOUT_MS,
      reconnectStrategy: (retries) =>
        retries > 5 ? false : Math.min(retries * 200, 1000),
    },
  });
  client.on("error", () => {});
  try {
    await withRateLimitTimeout(
      (async () => {
        if (!client.isOpen) await client.connect();
      })(),
      "connect"
    );
  } catch (error) {
    markRateLimitRedisUnavailable();
    void client.destroy();
    throw error;
  }
  return {
    increment: async (key, windowSeconds) => {
      const raw = await withRateLimitTimeout(
        client.eval(INCREMENT_LUA, {
          keys: [key],
          arguments: [String(windowSeconds)],
        }),
        "incr"
      );
      return parseIncrementResult(raw, windowSeconds);
    },
  };
}

async function getRedisStore(): Promise<RateLimitStore | null> {
  if (isRateLimitCircuitOpen()) return null;
  if (!storePromise) {
    storePromise = (async () => {
      const url = process.env.REDIS_URL?.trim();
      if (!url) return null;
      const token = process.env.REDIS_TOKEN?.trim();
      if (token) return createUpstashStore(url, token);
      if (url.startsWith("redis://") || url.startsWith("rediss://")) {
        return createNodeRedisStore(url);
      }
      return null;
    })().catch((error) => {
      markRateLimitRedisUnavailable();
      storePromise = null;
      console.warn(
        "[rate-limit] redis store unavailable:",
        error instanceof Error ? error.message : error
      );
      return null;
    });
  }
  return storePromise;
}

export function getClientIp(req: Request): string {
  return clientIpFromHeaders(req.headers);
}

/** Positive integer from env, otherwise the fallback. Treats 0 / NaN / negatives as unset. */
export function envRateLimit(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

function memoryResult(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const result = incrementMemory(key, options.windowMs);
  return {
    allowed: result.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - result.count),
    retryAfterSec: result.retryAfterSec,
    store: "memory",
  };
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const key = rateLimitKey(options.namespace, options.key);
  const windowSeconds = getWindowSeconds(options.windowMs);
  const redis = await getRedisStore();

  if (redis) {
    try {
      const result = await redis.increment(key, windowSeconds);
      return {
        allowed: result.count <= options.limit,
        limit: options.limit,
        remaining: Math.max(0, options.limit - result.count),
        retryAfterSec: result.retryAfterSec,
        store: "redis",
      };
    } catch (error) {
      markRateLimitRedisUnavailable();
      storePromise = null;
      console.warn(
        `[rate-limit] redis increment failed namespace=${options.namespace}:`,
        error instanceof Error ? error.message : error
      );
      /* fall through to memory */
    }
  }

  // failClosed only hard-fails when no shared Redis is configured at all.
  // If Redis is configured but briefly down, keep serving with in-process memory
  // so login/tickets are not bricked by a cache/Redis blip.
  if (options.failClosed && !redisConfigured()) {
    throw new Error("Shared rate limit unavailable");
  }

  if (options.failClosed && redisConfigured()) {
    console.warn(
      `[rate-limit] falling back to memory namespace=${options.namespace} (redis unavailable)`
    );
  }

  return memoryResult(key, options);
}

export async function enforceRateLimit(
  req: Request,
  options: Omit<RateLimitOptions, "key"> & { key?: string }
): Promise<NextResponse | null> {
  try {
    const subject = options.key ?? getClientIp(req);
    const result = await checkRateLimit({ ...options, key: subject });
    if (result.allowed) return null;

    console.warn(
      `[rate-limit] blocked namespace=${options.namespace} limit=${result.limit} remaining=${result.remaining} retryAfterSec=${result.retryAfterSec} store=${result.store}`
    );

    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSec),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": String(result.remaining),
        },
      }
    );
  } catch {
    if (!options.failClosed) return null;
    return NextResponse.json({ error: "Rate limit unavailable" }, { status: 503 });
  }
}

export function __resetRateLimitForTests(): void {
  memoryBuckets.clear();
  storePromise = null;
  rateLimitCircuit.unavailableUntil = 0;
}
