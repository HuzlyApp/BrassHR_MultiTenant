import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __setCacheAdapterForTests,
  buildCacheKey,
  deleteByPattern,
  getOrSetCache,
  hashQueryParams,
} from "@/lib/cache";

afterEach(() => {
  __setCacheAdapterForTests(undefined);
  vi.restoreAllMocks();
});

function memoryAdapter(initial = new Map<string, string>()) {
  return {
    store: initial,
    adapter: {
      async get(key: string) {
        return initial.get(key) ?? null;
      },
      async set(key: string, value: string) {
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

describe("cache utility", () => {
  it("returns cached Redis data without calling the fetcher", async () => {
    const key = buildCacheKey("profiles", ["user", "user-a"]);
    const { adapter, store } = memoryAdapter(new Map([[key, JSON.stringify({ id: "user-a" })]]));
    __setCacheAdapterForTests(adapter);
    const fetcher = vi.fn(async () => ({ id: "miss" }));

    await expect(getOrSetCache(key, fetcher, 60)).resolves.toEqual({ id: "user-a" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it("fetches and writes on cache miss", async () => {
    const key = buildCacheKey("profiles", ["user", "user-a"]);
    const { adapter, store } = memoryAdapter();
    __setCacheAdapterForTests(adapter);
    const fetcher = vi.fn(async () => ({ id: "user-a" }));

    await expect(getOrSetCache(key, fetcher, 60)).resolves.toEqual({ id: "user-a" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(store.get(key) ?? "{}")).toEqual({ id: "user-a" });
  });

  it("falls back to the fetcher when Redis operations fail", async () => {
    __setCacheAdapterForTests({
      async get() {
        throw new Error("redis down");
      },
      async set() {
        throw new Error("redis down");
      },
      async delete() {
        throw new Error("redis down");
      },
    });
    const fetcher = vi.fn(async () => ({ from: "supabase" }));

    await expect(getOrSetCache("supabase:test", fetcher, 60)).resolves.toEqual({
      from: "supabase",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps user and tenant scoped keys isolated", () => {
    const userA = buildCacheKey("profiles", ["user", "a"], { select: "*" });
    const userB = buildCacheKey("profiles", ["user", "b"], { select: "*" });
    const tenantA = buildCacheKey("projects", ["tenant", "a"], { page: 1 });
    const tenantB = buildCacheKey("projects", ["tenant", "b"], { page: 1 });

    expect(userA).not.toBe(userB);
    expect(tenantA).not.toBe(tenantB);
    expect(userA).toContain("supabase:profiles:user:a");
    expect(tenantA).toContain("supabase:projects:tenant:a");
  });

  it("hashes query params deterministically", () => {
    expect(hashQueryParams({ b: 2, a: 1 })).toBe(hashQueryParams({ a: 1, b: 2 }));
  });

  it("deletes matching cache keys by pattern", async () => {
    const { adapter, store } = memoryAdapter(
      new Map([
        ["supabase:profiles:user:a:1", "{}"],
        ["supabase:profiles:user:b:1", "{}"],
        ["supabase:projects:tenant:a:1", "{}"],
      ])
    );
    __setCacheAdapterForTests(adapter);

    await deleteByPattern("supabase:profiles:*");
    expect([...store.keys()]).toEqual(["supabase:projects:tenant:a:1"]);
  });
});
