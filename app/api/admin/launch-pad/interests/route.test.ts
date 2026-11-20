import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), read: vi.fn(), filter: vi.fn(), upsert: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/launch-pad/server", () => ({ requireLaunchPadContext: mocks.context }));
import { GET, PUT } from "./route";

const request = (body?: unknown) => new Request("https://brasshr.test/api/admin/launch-pad/interests", body ? { method: "PUT", body: JSON.stringify(body) } : undefined);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ tenantId: "tenant-a", auth: { userId: "owner-a" }, sb: { from: () => ({
    select: () => ({ eq: (...args: unknown[]) => { mocks.filter(...args); return { maybeSingle: mocks.read }; } }),
    upsert: (...args: unknown[]) => { mocks.upsert(...args); return { select: () => ({ single: mocks.save }) }; },
  }) } });
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.save.mockResolvedValue({ data: { interest_keys: ["hiring_onboarding"], skipped: false, answered_at: "2026-11-20T20:00:00Z" }, error: null });
});

describe("tenant signup interests", () => {
  it("returns an unanswered survey for a tenant with no response", async () => {
    const res = await GET(request());
    expect(await res.json()).toEqual({ tenantId: "tenant-a", interests: { keys: [], skipped: false, answeredAt: null } });
    expect(mocks.filter).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("loads a previous selection so the survey is not repeated", async () => {
    mocks.read.mockResolvedValue({ data: { interest_keys: ["hr_data_reporting"], skipped: false, answered_at: "2026-11-20T20:00:00Z" }, error: null });
    expect(await (await GET(request())).json()).toMatchObject({ interests: { keys: ["hr_data_reporting"], answeredAt: "2026-11-20T20:00:00Z" } });
  });
  it("maps stable, deduplicated keys to the authenticated tenant and user", async () => {
    const res = await PUT(request({ keys: ["hiring_onboarding", "hr_data_reporting", "hiring_onboarding"], skipped: false }));
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith({ tenant_id: "tenant-a", interest_keys: ["hr_data_reporting", "hiring_onboarding"], skipped: false, answered_by: "owner-a", answered_at: expect.any(String) }, { onConflict: "tenant_id" });
  });
  it("records an explicit skip separately from selecting no interests", async () => {
    expect((await PUT(request({ keys: [], skipped: true }))).status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ interest_keys: [], skipped: true }), expect.anything());
  });
  it.each([
    { keys: [], skipped: false }, { keys: ["unknown"], skipped: false },
    { keys: ["ai_powered_hr"], skipped: true }, { keys: ["ai_powered_hr"], skipped: false, tenantId: "tenant-b" },
  ])("rejects invalid interests or client-provided scope %j", async (body) => {
    expect((await PUT(request(body))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("preserves admin access denial", async () => {
    mocks.context.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await PUT(request({ keys: [], skipped: true }))).status).toBe(403);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("does not report success when saving fails", async () => {
    mocks.save.mockResolvedValue({ data: null, error: { code: "unavailable" } });
    expect((await PUT(request({ keys: ["ai_powered_hr"], skipped: false }))).status).toBe(503);
  });
});
