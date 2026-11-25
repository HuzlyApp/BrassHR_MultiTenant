import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-browser", () => ({ supabaseBrowser: { auth: { getSession } } }));
beforeEach(() => { vi.resetModules(); getSession.mockReset(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe("bounded staff token lookup", () => {
  it("preserves bearer authentication when the SDK returns a session", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: "test-token" } } });
    const { staffFetchInit } = await import("./staff-auth-headers");
    expect(await staffFetchInit({ "Content-Type": "application/json" })).toEqual({ credentials: "include", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" } });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("bounds a stalled SDK while sharing one lookup and retaining verified-cookie requests", async () => {
    getSession.mockImplementation(() => new Promise(() => {}));
    const { staffFetchInit } = await import("./staff-auth-headers");
    const requests = Promise.all([staffFetchInit(), staffFetchInit()]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await requests).toEqual([{ credentials: "include", headers: {} }, { credentials: "include", headers: {} }]);
    expect(getSession).toHaveBeenCalledOnce();
    const next = staffFetchInit();
    await vi.advanceTimersByTimeAsync(1000);
    await next;
    expect(getSession).toHaveBeenCalledOnce();
  });
});
