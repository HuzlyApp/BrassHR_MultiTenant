import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/launch-pad/server", () => ({ requireLaunchPadContext: mocks.context, loadLaunchPadProgress: mocks.load, saveLaunchPadStep: mocks.save }));
import { GET, POST } from "./route";

const ctx = { tenantId: "tenant-a", sb: {}, tenant: { subdomain: "test" } };
const request = (body?: unknown) => new Request("https://brasshr.test/api/admin/launch-pad/progress", body ? { method: "POST", body: JSON.stringify(body) } : undefined);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(ctx);
  mocks.load.mockResolvedValue({ logo: true, branding: false, domain: false, preview: false, invite: false, organization: false });
});

describe("server-owned Launch Pad progress", () => {
  it("loads progress for the authenticated tenant", async () => {
    const res = await GET(request());
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ tenantId: "tenant-a", progress: { logo: true, domain: false } });
    expect(mocks.load).toHaveBeenCalledWith(ctx);
  });
  it("records only the confirmed step", async () => {
    expect((await POST(request({ stepId: "branding" }))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(ctx, "branding");
  });
  it.each([{ stepId: "domain" }, { stepId: "skipped" }, { stepId: "logo", tenantId: "tenant-b" }, { progress: { domain: true } }])("rejects invalid completion input %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("preserves access rejection", async () => {
    mocks.context.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    expect((await POST(request({ stepId: "logo" }))).status).toBe(403);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not return success when persistence fails", async () => {
    mocks.save.mockRejectedValue(new Error("Unavailable"));
    expect((await POST(request({ stepId: "logo" }))).status).toBe(503);
  });
});
