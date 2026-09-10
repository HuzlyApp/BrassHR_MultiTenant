import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStaffDetailJson,
  invalidateStaffDetailCache,
  prefetchStaffDetail,
} from "./staff-detail-fetch-cache";

describe("staff detail fetch cache", () => {
  afterEach(() => {
    invalidateStaffDetailCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("dedupes in-flight requests for the same URL", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = fetchStaffDetailJson<{ n: number }>("/api/admin/jobs/1?view=details");
    const second = fetchStaffDetailJson<{ n: number }>("/api/admin/jobs/1?view=details");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      new Response(JSON.stringify({ n: 1 }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    await expect(first).resolves.toEqual({ ok: true, status: 200, payload: { n: 1 } });
    await expect(second).resolves.toEqual({ ok: true, status: 200, payload: { n: 1 } });
  });

  it("returns the cached payload on repeat opens without refetching", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ job: { id: "j1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchStaffDetailJson("/api/admin/jobs/j1?view=details");
    await fetchStaffDetailJson("/api/admin/jobs/j1?view=details");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("busts the cache when asked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ n: 1 }), { status: 200, headers: { "Content-Type": "application/json" } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ n: 2 }), { status: 200, headers: { "Content-Type": "application/json" } })
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchStaffDetailJson<{ n: number }>("/api/admin/jobs/j1?view=details");
    const busted = await fetchStaffDetailJson<{ n: number }>("/api/admin/jobs/j1?view=details", {
      bust: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(busted.payload).toEqual({ n: 2 });
  });

  it("does not cache failed responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "nope" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ n: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchStaffDetailJson("/api/admin/jobs/j1?view=details");
    const retry = await fetchStaffDetailJson<{ n: number }>("/api/admin/jobs/j1?view=details");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retry.payload).toEqual({ n: 1 });
  });

  it("prefetch populates the cache", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    prefetchStaffDetail("/api/admin/candidates/w1/profile");
    await fetchStaffDetailJson("/api/admin/candidates/w1/profile");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
