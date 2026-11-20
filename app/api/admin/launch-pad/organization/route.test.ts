import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), update: vi.fn(), filter: vi.fn(), save: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: mocks.scope }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => ({
  update: (values: unknown) => { mocks.update(values); return { eq: (...args: unknown[]) => { mocks.filter(...args); return { select: () => ({ maybeSingle: mocks.save }) }; } }; },
}) }) }));
vi.mock("@/lib/tenant/invalidate-tenant-branding-cache", () => ({ invalidateTenantBrandingCache: mocks.invalidate }));
import { PATCH } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ role: "admin", godAdmin: false });
  mocks.scope.mockResolvedValue("tenant-a");
  mocks.save.mockResolvedValue({ data: { id: "tenant-a" }, error: null });
});
const request = (body: unknown) => new Request("https://brasshr.test/api/admin/launch-pad/organization", { method: "PATCH", body: JSON.stringify(body) });
describe("optional Launch Pad organization details", () => {
  it("saves partial details only to the resolved tenant", async () => {
    expect((await PATCH(request({ address: "123 Main St", ein: "12-3456789", tenantId: "tenant-b" }))).status).toBe(200);
    expect(mocks.filter).toHaveBeenCalledWith("id", "tenant-a");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ address_line_1: "123 Main St", ein: "12-3456789" }));
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("company_size");
  });
  it("rejects malformed EINs without saving", async () => {
    expect((await PATCH(request({ ein: "bad-ein" }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires tenant admin access", async () => {
    mocks.auth.mockResolvedValue({ role: "recruiter", godAdmin: false });
    expect((await PATCH(request({ address: "Main St" }))).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reports a failed save rather than completion", async () => {
    mocks.save.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await PATCH(request({ address: "Main St" }))).status).toBe(500);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
