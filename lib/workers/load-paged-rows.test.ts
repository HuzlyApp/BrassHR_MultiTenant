import { describe, expect, it, vi } from "vitest";
import { loadPagedRows } from "@/lib/workers/load-paged-rows";

describe("loadPagedRows", () => {
  it("stops after the first short page and drops later pages from that batch", async () => {
    const rows = await loadPagedRows(
      async (from) => {
        if (from >= 6) return ["leak"];
        const all = ["a", "b", "c", "d", "e"];
        return all.slice(from, from + 2);
      },
      { pageSize: 2, batchSize: 4, maxPages: 10 }
    );
    expect(rows).toEqual(["a", "b", "c", "d", "e"]);
    expect(rows).not.toContain("leak");
  });

  it("does not request more pages when the first page is short", async () => {
    const fetchPage = vi.fn(async () => ["only"]);
    const rows = await loadPagedRows(fetchPage, { pageSize: 2, batchSize: 4 });
    expect(rows).toEqual(["only"]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("propagates a page failure instead of caching a partial scan", async () => {
    await expect(
      loadPagedRows(async (from) => {
        if (from > 0) throw new Error("page failed");
        return ["a", "b"];
      }, { pageSize: 2, batchSize: 2 })
    ).rejects.toThrow("page failed");
  });
});
