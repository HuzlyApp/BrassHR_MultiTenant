import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCandidatesListUrlState, serializeCandidatesListUrlState } from "@/lib/workers/candidates-list-url";
import {
  invalidateCandidatesListCache,
  isLatestCandidatesListRequest,
  nextCandidatesListRequest,
  readCandidatesListCache,
  resetCandidatesListCacheForTests,
  writeCandidatesListCache,
} from "@/lib/workers/candidates-list-session-cache";

describe("candidates list URL state", () => {
  it("round-trips search, filters, sort, and page", () => {
    const parsed = parseCandidatesListUrlState(
      new URLSearchParams(
        "q=smith&skills=ICU&jobRole=RN&page=2&pageSize=25&sort=name&sortDir=asc&assignee=unassigned&multiJob=1"
      )
    );
    expect(parsed.q).toBe("smith");
    expect(parsed.skills).toBe("ICU");
    expect(parsed.jobRole).toBe("RN");
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(25);
    expect(parsed.sortColumn).toBe("name");
    expect(parsed.sortDir).toBe("asc");
    expect(parsed.assignee).toBe("unassigned");
    expect(parsed.multiJob).toBe(true);
    expect(parseCandidatesListUrlState(new URLSearchParams(serializeCandidatesListUrlState(parsed)))).toEqual(
      parsed
    );
  });

  it("drops invalid page size and sort values", () => {
    const parsed = parseCandidatesListUrlState(
      new URLSearchParams("pageSize=999&sort=not-a-column&page=0")
    );
    expect(parsed.pageSize).toBe(15);
    expect(parsed.sortColumn).toBeNull();
    expect(parsed.page).toBe(1);
  });
});

describe("candidates list session cache", () => {
  afterEach(() => {
    resetCandidatesListCacheForTests();
    vi.unstubAllGlobals();
  });

  function installSessionStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      get length() {
        return store.size;
      },
      key(index: number) {
        return [...store.keys()][index] ?? null;
      },
      getItem(key: string) {
        return store.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    });
    return store;
  }

  it("does not return another user or tenant's rows", () => {
    writeCandidatesListCache("user-a:tenant-a", "q=smith", [{ id: "1" }], 1);
    expect(readCandidatesListCache("user-b:tenant-a", "q=smith")).toBeNull();
    expect(readCandidatesListCache("user-a:tenant-b", "q=smith")).toBeNull();
    expect(readCandidatesListCache("user-a:tenant-a", "q=smith")?.rows).toEqual([{ id: "1" }]);
  });

  it("refuses a cache scope that is missing a user or tenant", () => {
    writeCandidatesListCache(":tenant-a", "q=smith", [{ id: "1" }], 1);
    writeCandidatesListCache("user-a:", "q=smith", [{ id: "1" }], 1);
    expect(readCandidatesListCache(":tenant-a", "q=smith")).toBeNull();
    expect(readCandidatesListCache("user-a:", "q=smith")).toBeNull();
  });

  it("drops cached rows after an edit invalidation", () => {
    writeCandidatesListCache("user-a:tenant-a", "page=2", [{ id: "1" }], 1);
    invalidateCandidatesListCache();
    expect(readCandidatesListCache("user-a:tenant-a", "page=2")).toBeNull();
  });

  it("restores the same user and tenant from sessionStorage after memory is cleared", () => {
    installSessionStorage();
    writeCandidatesListCache("user-a:tenant-a", "q=smith", [{ id: "1" }], 4);
    const saved = new Map<string, string>();
    for (let i = 0; i < sessionStorage.length; i++) {
      const storageName = sessionStorage.key(i);
      if (!storageName) continue;
      const value = sessionStorage.getItem(storageName);
      if (value != null) saved.set(storageName, value);
    }
    resetCandidatesListCacheForTests();
    for (const [storageName, value] of saved) {
      if (storageName.includes("invalidated")) continue;
      sessionStorage.setItem(storageName, value);
    }

    expect(readCandidatesListCache("user-a:tenant-a", "q=smith")).toEqual({
      rows: [{ id: "1" }],
      total: 4,
    });
    expect(readCandidatesListCache("user-b:tenant-a", "q=smith")).toBeNull();
  });

  it("ignores an older in-flight list request", () => {
    const first = nextCandidatesListRequest();
    const second = nextCandidatesListRequest();
    expect(isLatestCandidatesListRequest(first)).toBe(false);
    expect(isLatestCandidatesListRequest(second)).toBe(true);
  });
});
