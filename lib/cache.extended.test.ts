import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __setCacheAdapterForTests,
  buildCacheKey,
  CACHE_TTL_SECONDS,
  getOrSetCache,
  invalidateTenantCache,
  invalidateUserCache,
} from "@/lib/cache";
import { tenantPattern, userPattern } from "@/lib/cache-keys";

afterEach(() => {
  __setCacheAdapterForTests(undefined);
  vi.restoreAllMocks();
});

function memoryAdapter(initial = new Map<string, string>()) {
  let lastTtl = 0;
  return {
    store: initial,
    lastTtl: () => lastTtl,
    adapter: {
      async get(key: string) {
        return initial.get(key) ?? null;
      },
      async set(key: string, value: string, ttlSeconds: number) {
        lastTtl = ttlSeconds;
        initial.set(key, value);
      },
      async delete(key: string) {
        initial.delete(key);
      },
      async deleteByPattern(pattern: string) {
        const prefix = pattern.replace(/\*$/, "");
        for (const key of [...initial.keys()]) {
          if (key.startsWith(prefix)) initial.delete(key);
        }
      },
    },
  };
}

describe("cache utility extended", () => {
  it("calls loader once on miss and zero times on hit", async () => {
    const key = buildCacheKey("demo", ["tenant", "t1"]);
    const { adapter } = memoryAdapter();
    __setCacheAdapterForTests(adapter);
    const fetcher = vi.fn(async () => ({ n: 1 }));

    await getOrSetCache(key, fetcher, 120);
    await getOrSetCache(key, fetcher, 120);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("passes TTL to adapter set", async () => {
    const key = buildCacheKey("demo", ["tenant", "t2"]);
    const { adapter, lastTtl } = memoryAdapter();
    __setCacheAdapterForTests(adapter);
    await getOrSetCache(key, async () => ({ ok: true }), 777);
    expect(lastTtl()).toBe(777);
  });

  it("falls back to loader when adapter is null (cache disabled)", async () => {
    __setCacheAdapterForTests(null);
    const fetcher = vi.fn(async () => ({ from: "db" }));
    const key = buildCacheKey("demo", ["tenant", "off"]);
    await expect(getOrSetCache(key, fetcher, 60)).resolves.toEqual({ from: "db" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to loader when get throws", async () => {
    __setCacheAdapterForTests({
      async get() {
        throw new Error("redis down");
      },
      async set() {},
      async delete() {},
    });
    const fetcher = vi.fn(async () => ({ from: "db" }));
    await expect(getOrSetCache("supabase:fallback", fetcher, 60)).resolves.toEqual({
      from: "db",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("admin header cache keys include user and tenant scope", () => {
    const tenantA = buildCacheKey(
      "admin_header_data",
      ["user", "u1", "tenant", "tenant-a"],
      { limit: 40 },
    );
    const tenantB = buildCacheKey(
      "admin_header_data",
      ["user", "u1", "tenant", "tenant-b"],
      { limit: 40 },
    );
    expect(tenantA).not.toBe(tenantB);
    expect(tenantA).toContain("tenant:tenant-a");
    expect(tenantB).toContain("tenant:tenant-b");
  });

  it("invalidateTenantCache removes tenant-scoped keys only", async () => {
    const { adapter, store } = memoryAdapter(
      new Map([
        ["supabase:worker:tenant:aaa:1", "{}"],
        ["supabase:worker:tenant:bbb:1", "{}"],
      ]),
    );
    __setCacheAdapterForTests(adapter);
    await invalidateTenantCache("worker", "aaa");
    expect([...store.keys()]).toEqual(["supabase:worker:tenant:bbb:1"]);
    expect(tenantPattern("worker", "aaa")).toBe("supabase:worker:tenant:aaa:*");
  });

  it("invalidateUserCache removes user-scoped keys only", async () => {
    const { adapter, store } = memoryAdapter(
      new Map([
        ["supabase:admin_header_data:user:u1:1", "{}"],
        ["supabase:admin_header_data:user:u2:1", "{}"],
      ]),
    );
    __setCacheAdapterForTests(adapter);
    await invalidateUserCache("admin_header_data", "u1");
    expect([...store.keys()]).toEqual(["supabase:admin_header_data:user:u2:1"]);
    expect(userPattern("admin_header_data", "u1")).toBe(
      "supabase:admin_header_data:user:u1:*",
    );
  });

  it("documents dashboard cache TTL bucket", () => {
    expect(CACHE_TTL_SECONDS.dashboards).toBe(120);
    expect(CACHE_TTL_SECONDS.tenantConfig).toBe(900);
    expect(CACHE_TTL_SECONDS.searchResults).toBe(60);
  });
});

describe("tenant-branding cache key", () => {
  it("scopes by slug lookup kind", () => {
    const a = buildCacheKey("tenant_branding", ["slug", "braas-hr"], { fields: "x" });
    const b = buildCacheKey("tenant_branding", ["slug", "other"], { fields: "x" });
    expect(a).not.toBe(b);
  });
});
