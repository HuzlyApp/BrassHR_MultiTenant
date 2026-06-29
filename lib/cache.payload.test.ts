import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __setCacheAdapterForTests,
  getMaxCachePayloadBytes,
  getOrSetCache,
} from "@/lib/cache";

afterEach(() => {
  __setCacheAdapterForTests(undefined);
  vi.restoreAllMocks();
  delete process.env.CACHE_MAX_PAYLOAD_BYTES;
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
    },
  };
}

describe("cache payload size guard", () => {
  it("caches small payloads", async () => {
    const { adapter, store } = memoryAdapter();
    __setCacheAdapterForTests(adapter);
    const fetcher = vi.fn(async () => ({ ok: true }));

    await getOrSetCache("supabase:small", fetcher, 60);
    await getOrSetCache("supabase:small", fetcher, 60);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);
  });

  it("skips cache write for payloads larger than max bytes", async () => {
    process.env.CACHE_MAX_PAYLOAD_BYTES = "64";
    const { adapter, store } = memoryAdapter();
    __setCacheAdapterForTests(adapter);
    const largeValue = { blob: "x".repeat(128) };
    const fetcher = vi.fn(async () => largeValue);

    const first = await getOrSetCache("supabase:large", fetcher, 60);
    const second = await getOrSetCache("supabase:large", fetcher, 60);

    expect(first).toEqual(largeValue);
    expect(second).toEqual(largeValue);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(0);
  });

  it("defaults max payload to 100KB", () => {
    expect(getMaxCachePayloadBytes()).toBe(102400);
  });
});
