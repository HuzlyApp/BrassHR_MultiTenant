import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), access: vi.fn(), role: { is_admin: false, is_system: false } as { is_admin: boolean; is_system: boolean } | null }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff-a", authUser: { id: "staff-a" } }) }));
vi.mock("@/lib/auth/user-management", () => ({ requireUserManagement: async () => null }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: async () => "tenant-a" }));
vi.mock("@/lib/auth/cached-session-grants", () => ({ loadFreshViewerStaffAccess: mocks.access }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ rpc: mocks.rpc, from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: mocks.role, error: null }), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ key: "hiring" }, { key: "settings_company" }], error: null }).then(resolve) }; return q; } }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.role = { is_admin: false, is_system: false }; mocks.rpc.mockResolvedValue({ error: null }); mocks.access.mockResolvedValue(null); });
const request = (permissions: unknown = [{ resourceKey: "hiring", canView: true, canEdit: true, canDelete: false }]) => new Request("https://brasshr.test/api/admin/roles/recruiter", { method: "PATCH", body: JSON.stringify({ label: "Recruiter", description: "Hiring", permissions }) });
const context = { params: Promise.resolve({ roleKey: "recruiter" }) };
describe("atomic tenant role save", () => {
  it("saves once through the scoped RPC and then refreshes current viewer access", async () => {
    expect((await PATCH(request(), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("update_tenant_role_permissions", expect.objectContaining({ p_tenant_id: "tenant-a", p_role_key: "recruiter", p_label: "Recruiter", p_permissions: expect.arrayContaining([expect.objectContaining({ resource_key: "hiring", can_edit: true })]) }));
    expect(mocks.access).toHaveBeenCalledTimes(1);
  });
  it("reports an atomic save failure without returning refreshed grants", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "Database failed" } });
    expect((await PATCH(request(), context)).status).toBe(500);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("rejects an unavailable role before invoking the save", async () => {
    mocks.role = null;
    expect((await PATCH(request(), context)).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("retains the protected system admin company-settings guard", async () => {
    mocks.role = { is_admin: true, is_system: true };
    expect((await PATCH(request([{ resourceKey: "settings_company", canView: false, canEdit: false, canDelete: false }]), context)).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
