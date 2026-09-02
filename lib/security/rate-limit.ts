import "server-only";

import { Redis as UpstashRedis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { hashQueryParams } from "@/lib/cache-keys";
import {
  getRedisTimeoutMs,
  isRedisCircuitOpen,
  markRedisUnavailable,
  withRedisTimeout,
} from "@/lib/redis-timeout";

type RateLimitCount = { count: number; retryAfterSec: number };

type RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<RateLimitCount>;
};

type Bucket = { count: number; expiresAt: number };

type CounterClient = {
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

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

/**
 * INCR then ensure the key has a TTL. Lost expires used to leave a counter that
 * never reset, so recruiters stayed blocked after the hour window.
 */
async function incrementWithWindow(
  client: CounterClient,
  key: string,
  windowSeconds: number
): Promise<RateLimitCount> {
  const count = toPositiveInt(await client.incr(key), 1);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }
  let ttl = Number(await client.ttl(key));
  if (!Number.isFinite(ttl) || ttl < 0) {
    await client.expire(key, windowSeconds);
    ttl = windowSeconds;
  }
  return {
    count,
    retryAfterSec: ttl > 0 ? Math.ceil(ttl) : windowSeconds,
  };
}

async function createUpstashStore(url: string, token: string): Promise<RateLimitStore> {
  const redis = new UpstashRedis({ url, token });
  return {
    increment: (key, windowSeconds) =>
      incrementWithWindow(
        {
          incr: (k) => redis.incr(k),
          ttl: (k) => redis.ttl(k),
          expire: (k, seconds) => redis.expire(k, seconds),
        },
        key,
        windowSeconds
      ),
  };
}

async function createNodeRedisStore(url: string): Promise<RateLimitStore> {
  const { createClient } = await import("redis");
  const connectMs = getRedisTimeoutMs();
  const client = createClient({
    url,
    socket: {
      connectTimeout: connectMs,
      reconnectStrategy: (retries) => (retries > 2 ? false : Math.min(retries * 200, 1000)),
    },
  });
  client.on("error", () => {});
  try {
    await withRedisTimeout(
      (async () => {
        if (!client.isOpen) await client.connect();
      })(),
      "rate-limit-connect",
    );
  } catch (error) {
    markRedisUnavailable();
    void client.destroy();
    throw error;
  }
  return {
    increment: (key, windowSeconds) =>
      incrementWithWindow(
        {
          incr: (k) => withRedisTimeout(client.incr(k), "rate-limit-incr"),
          ttl: (k) => withRedisTimeout(client.ttl(k), "rate-limit-ttl"),
          expire: (k, seconds) =>
            withRedisTimeout(client.expire(k, seconds), "rate-limit-expire"),
        },
        key,
        windowSeconds
      ),
  };
}

async function getRedisStore(): Promise<RateLimitStore | null> {
  if (isRedisCircuitOpen()) return null;
  if (!storePromise) {
    storePromise = withRedisTimeout(
      (async () => {
        const url = process.env.REDIS_URL?.trim();
        if (!url) return null;
        const token = process.env.REDIS_TOKEN?.trim();
        if (token) return createUpstashStore(url, token);
        if (url.startsWith("redis://") || url.startsWith("rediss://")) {
          return createNodeRedisStore(url);
        }
        return null;
      })(),
      "rate-limit-adapter",
    ).catch(() => {
      markRedisUnavailable();
      storePromise = null;
      return null;
    });
  }
  return storePromise;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  return forwarded || realIp || cfIp || "unknown";
}

/** Positive integer from env, otherwise the fallback. Treats 0 / NaN / negatives as unset. */
export function envRateLimit(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.floor(raw);
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const key = rateLimitKey(options.namespace, options.key);
  const windowSeconds = getWindowSeconds(options.windowMs);
  const redis = await getRedisStore();

  if (redis) {
    try {
      const result = await withRedisTimeout(
        redis.increment(key, windowSeconds),
        "rate-limit-check"
      );
      return {
        allowed: result.count <= options.limit,
        limit: options.limit,
        remaining: Math.max(0, options.limit - result.count),
        retryAfterSec: result.retryAfterSec,
        store: "redis",
      };
    } catch {
      markRedisUnavailable();
      /* fall through to memory when Redis is slow/unavailable */
    }
  }

  const result = incrementMemory(key, options.windowMs);
  return {
    allowed: result.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - result.count),
    retryAfterSec: result.retryAfterSec,
    store: "memory",
  };
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
}
