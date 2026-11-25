import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  __setCacheAdapterForTests,
  buildCacheKey,
  deleteByPattern,
  deleteCache,
  getOrSetCache,
  hashQueryParams,
  tablePattern,
} from "@/lib/cache";

const circuit = vi.hoisted(() => ({ open: false }));
vi.mock("@/lib/redis-timeout", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/redis-timeout")>(),
  isRedisCircuitOpen: () => circuit.open,
  markRedisUnavailable: () => { circuit.open = true; },
}));
beforeEach(() => { circuit.open = false; });

afterEach(() => {
  vi.useRealTimers();
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
  it("returns fresh data and keeps the memory fallback when a Redis write stalls", async () => {
    vi.useFakeTimers();
    __setCacheAdapterForTests({
      get: async () => null, set: () => new Promise(() => {}), delete: async () => {},
    });
    const pending = getOrSetCache("timeout:write", async () => ({ fresh: true }));
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toEqual({ fresh: true });
    const fetcher = vi.fn();
    await expect(getOrSetCache("timeout:write", fetcher)).resolves.toEqual({ fresh: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(circuit.open).toBe(true);
  });

  it.each(["key", "pattern"])("bounds a stalled %s invalidation", async (kind) => {
    vi.useFakeTimers();
    __setCacheAdapterForTests({
      get: async () => null, set: async () => {},
      delete: () => new Promise(() => {}), deleteByPattern: () => new Promise(() => {}),
    });
    const pending = kind === "key" ? deleteCache("timeout:delete") : deleteByPattern("timeout:*");
    await vi.advanceTimersByTimeAsync(3000);
    await expect(pending).resolves.toBeUndefined();
    expect(circuit.open).toBe(true);
  });

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

  it("skips a failed adapter throughout cooldown and retries it after recovery", async () => {
    const get = vi.fn().mockRejectedValue(new Error("redis unavailable"));
    const set = vi.fn().mockResolvedValue(undefined);
    __setCacheAdapterForTests({ get, set, delete: vi.fn() });
    await getOrSetCache("circuit:first", async () => 1);
    await getOrSetCache("circuit:second", async () => 2);
    expect(get).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    circuit.open = false;
    get.mockResolvedValue(null);
    await getOrSetCache("circuit:recovered", async () => 3);
    expect(get).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledOnce();
  });

  it("keeps user and tenant scoped keys isolated", () => {
    const userA = buildCacheKey("profiles", ["user", "a"], { select: "*" });
    const userB = buildCacheKey("profiles", ["user", "b"], { select: "*" });
    const tenantA = buildCacheKey("projects", ["tenant", "a"], { page: 1 });
    const tenantB = buildCacheKey("projects", ["tenant", "b"], { page: 1 });

    expect(userA).not.toBe(userB);
    expect(tenantA).not.toBe(tenantB);
    expect(userA).toContain(":profiles:user:a");
    expect(tenantA).toContain(":projects:tenant:a");
    expect(userA.startsWith("supabase:")).toBe(true);
  });

  it("hashes query params deterministically", () => {
    expect(hashQueryParams({ b: 2, a: 1 })).toBe(hashQueryParams({ a: 1, b: 2 }));
  });

  it("deletes matching cache keys by pattern", async () => {
    const profilesA = `${buildCacheKey("profiles", ["user", "a"])}:1`;
    const profilesB = `${buildCacheKey("profiles", ["user", "b"])}:1`;
    const projectsA = `${buildCacheKey("projects", ["tenant", "a"])}:1`;
    const { adapter, store } = memoryAdapter(
      new Map([
        [profilesA, "{}"],
        [profilesB, "{}"],
        [projectsA, "{}"],
      ])
    );
    __setCacheAdapterForTests(adapter);

    await deleteByPattern(tablePattern("profiles"));
    expect([...store.keys()]).toEqual([projectsA]);
  });
});
