import { afterEach, describe, expect, it, vi } from "vitest";
import { createResilientFetch } from "./resilient-fetch";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Supabase fetch cancellation and retries", () => {
  it("retries transient read failures", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const pending = createResilientFetch()("https://db.test/rest/v1/jobs");
    await vi.advanceTimersByTimeAsync(400);
    expect((await pending).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["POST", "PATCH", "DELETE", "PUT"])("never replays an uncertain %s write", async (method) => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    await expect(createResilientFetch()("https://db.test/rest/v1/jobs", { method }))
      .rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("respects the method on Request inputs", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    await expect(createResilientFetch()(new Request("https://db.test/rest/v1/jobs", { method: "POST" })))
      .rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(["caller", "deadline"])("does not retry %s cancellation", async (reason) => {
    vi.useFakeTimers();
    const fetch = vi.fn((_input, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetch);
    const controller = new AbortController();
    const pending = createResilientFetch({ timeoutMs: 100 })("https://db.test/rest/v1/jobs", { signal: controller.signal });
    const rejected = expect(pending).rejects.toThrow("Aborted");
    if (reason === "caller") controller.abort();
    else await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
