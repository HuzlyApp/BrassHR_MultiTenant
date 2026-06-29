import { Redis as UpstashRedis } from "@upstash/redis";
export { buildCacheKey, CACHE_TTL_SECONDS } from "@/lib/cache-keys";
import {
  isRedisCircuitOpen,
  markRedisUnavailable,
  withRedisTimeout,
} from "@/lib/redis-timeout";

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_DEFAULT_TTL_SECONDS ?? 300) || 300;

type CacheAdapter = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

let adapterPromise: Promise<CacheAdapter | null> | null = null;

function cacheEnabled(): boolean {
  return process.env.CACHE_ENABLED === "true";
}

function logCache(event: string, detail: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.debug(`[cache:${event}]`, detail);
  }
}

async function createUpstashAdapter(url: string, token: string): Promise<CacheAdapter> {
  const redis = new UpstashRedis({ url, token });
  return {
    async get(key) {
      const value = await redis.get<string>(key);
      return typeof value === "string" ? value : value == null ? null : JSON.stringify(value);
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
  };
}

async function createAdapter(): Promise<CacheAdapter | null> {
  if (!cacheEnabled()) return null;
  if (isRedisCircuitOpen()) return null;

  const url = process.env.REDIS_URL?.trim();
  const token = process.env.REDIS_TOKEN?.trim();
  if (!url || !token) return null;

  return createUpstashAdapter(url, token);
}

async function getAdapter(): Promise<CacheAdapter | null> {
  if (!adapterPromise) {
    adapterPromise = withRedisTimeout(createAdapter(), "edge-adapter").catch((error) => {
      logCache("adapter-error", error);
      markRedisUnavailable();
      adapterPromise = null;
      return null;
    });
  }
  return adapterPromise;
}

export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<T> {
  try {
    const adapter = await getAdapter();
    if (adapter) {
      const cached = await withRedisTimeout(adapter.get(key), "edge-get");
      if (cached != null) {
        logCache("hit", key);
        return JSON.parse(cached) as T;
      }
      logCache("miss", key);
    }
  } catch (error) {
    logCache("error", { key, error });
    markRedisUnavailable();
  }

  const value = await fetcher();
  try {
    const adapter = await getAdapter();
    if (adapter) {
      await withRedisTimeout(adapter.set(key, JSON.stringify(value), ttlSeconds), "edge-set");
    }
  } catch (error) {
    logCache("set-error", { key, error });
    markRedisUnavailable();
  }
  return value;
}
