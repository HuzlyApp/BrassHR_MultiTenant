import "server-only";

import { Redis as UpstashRedis } from "@upstash/redis";
import {
  buildCacheKey,
  CACHE_TTL_SECONDS,
  hashQueryParams,
  resourcePattern,
  tablePattern,
  tenantPattern,
  userPattern,
} from "@/lib/cache-keys";

export {
  buildCacheKey,
  CACHE_TTL_SECONDS,
  hashQueryParams,
  tablePattern,
  tenantPattern,
  userPattern,
  resourcePattern,
};

const DEFAULT_TTL_SECONDS = Number(process.env.CACHE_DEFAULT_TTL_SECONDS ?? 300) || 300;

type CacheAdapter = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPattern?(pattern: string): Promise<void>;
};

let adapterPromise: Promise<CacheAdapter | null> | null = null;
let testAdapter: CacheAdapter | null | undefined;

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
    async delete(key) {
      await redis.del(key);
    },
    async deleteByPattern(pattern) {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
        cursor = Number(nextCursor);
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== 0);
    },
  };
}

async function createNodeRedisAdapter(url: string): Promise<CacheAdapter> {
  const { createClient } = await import("redis");
  const client = createClient({ url });
  client.on("error", (error) => logCache("redis-error", error));
  if (!client.isOpen) await client.connect();

  return {
    async get(key) {
      return client.get(key);
    },
    async set(key, value, ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
    },
    async delete(key) {
      await client.del(key);
    },
    async deleteByPattern(pattern) {
      const keys: string[] = [];
      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(String(key));
        if (keys.length >= 100) {
          await client.del(keys.splice(0, keys.length));
        }
      }
      if (keys.length > 0) await client.del(keys);
    },
  };
}

async function createAdapter(): Promise<CacheAdapter | null> {
  if (!cacheEnabled()) return null;

  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  const token = process.env.REDIS_TOKEN?.trim();
  if (token) {
    return createUpstashAdapter(url, token);
  }

  if (url.startsWith("redis://") || url.startsWith("rediss://")) {
    return createNodeRedisAdapter(url);
  }

  logCache("disabled", "REDIS_TOKEN is required for HTTP Redis URLs");
  return null;
}

async function getAdapter(): Promise<CacheAdapter | null> {
  if (testAdapter !== undefined) return testAdapter;
  if (!adapterPromise) {
    adapterPromise = createAdapter().catch((error) => {
      logCache("adapter-error", error);
      return null;
    });
  }
  return adapterPromise;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const adapter = await getAdapter();
    if (!adapter) return null;

    const cached = await adapter.get(key);
    if (cached == null) {
      logCache("miss", key);
      return null;
    }

    logCache("hit", key);
    return JSON.parse(cached) as T;
  } catch (error) {
    logCache("error", { key, error });
    return null;
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  if (value === undefined) return;

  try {
    const adapter = await getAdapter();
    if (!adapter) return;
    await adapter.set(key, JSON.stringify(value), ttlSeconds);
  } catch (error) {
    logCache("set-error", { key, error });
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const adapter = await getAdapter();
    if (!adapter) return;
    await adapter.delete(key);
  } catch (error) {
    logCache("delete-error", { key, error });
  }
}

export async function deleteByPattern(pattern: string): Promise<void> {
  try {
    const adapter = await getAdapter();
    if (!adapter?.deleteByPattern) return;
    await adapter.deleteByPattern(pattern);
  } catch (error) {
    logCache("delete-pattern-error", { pattern, error });
  }
}

export async function getOrSetCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  await setCache(key, value, ttlSeconds);
  return value;
}

export async function invalidateTableCache(table: string): Promise<void> {
  await deleteByPattern(tablePattern(table));
}

export async function invalidateTenantCache(table: string, tenantId: string): Promise<void> {
  await deleteByPattern(tenantPattern(table, tenantId));
}

export async function invalidateUserCache(table: string, userId: string): Promise<void> {
  await deleteByPattern(userPattern(table, userId));
}

export async function invalidateResourceCache(table: string, resourceId: string): Promise<void> {
  await deleteByPattern(resourcePattern(table, resourceId));
}

export function __setCacheAdapterForTests(adapter: CacheAdapter | null | undefined): void {
  testAdapter = adapter;
  adapterPromise = null;
}
