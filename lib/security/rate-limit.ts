import { createHash } from "node:crypto";
import { Redis as UpstashRedis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { createClient as createNodeRedisClient, type RedisClientType } from "redis";

type RateLimitStore = {
  increment(key: string, windowSeconds: number): Promise<number>;
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

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function rateLimitKey(namespace: string, key: string): string {
  return `rate-limit:${namespace}:${hashKey(key)}`;
}

function getWindowSeconds(windowMs: number): number {
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function incrementMemory(key: string, windowMs: number): number {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.expiresAt <= now) {
    memoryBuckets.set(key, { count: 1, expiresAt: now + windowMs });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

function getMemoryRetryAfterSec(key: string): number {
  const bucket = memoryBuckets.get(key);
  if (!bucket) return 1;
  return Math.max(1, Math.ceil((bucket.expiresAt - Date.now()) / 1000));
}

async function createUpstashStore(url: string, token: string): Promise<RateLimitStore> {
  const redis = new UpstashRedis({ url, token });
  return {
    async increment(key, windowSeconds) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      return count;
    },
  };
}

async function createNodeRedisStore(url: string): Promise<RateLimitStore> {
  const client: RedisClientType = createNodeRedisClient({ url });
  client.on("error", () => {});
  if (!client.isOpen) await client.connect();
  return {
    async increment(key, windowSeconds) {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, windowSeconds);
      return count;
    },
  };
}

async function getRedisStore(): Promise<RateLimitStore | null> {
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
    })().catch(() => null);
  }
  return storePromise;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cfIp = req.headers.get("cf-connecting-ip")?.trim();
  return forwarded || realIp || cfIp || "unknown";
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const key = rateLimitKey(options.namespace, options.key);
  const windowSeconds = getWindowSeconds(options.windowMs);
  const redis = await getRedisStore();

  if (redis) {
    const count = await redis.increment(key, windowSeconds);
    return {
      allowed: count <= options.limit,
      limit: options.limit,
      remaining: Math.max(0, options.limit - count),
      retryAfterSec: windowSeconds,
      store: "redis",
    };
  }

  const count = incrementMemory(key, options.windowMs);
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSec: getMemoryRetryAfterSec(key),
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
