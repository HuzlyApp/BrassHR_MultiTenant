import { beforeEach, describe, expect, it, vi } from "vitest";
import { inviteStaff } from "./staff-directory";
const mocks = vi.hoisted(() => ({ conflict: vi.fn(), identity: vi.fn(), create: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/lib/tenant/tenant-email-uniqueness", async (original) => ({
  ...await original<typeof import("@/lib/tenant/tenant-email-uniqueness")>(),
  findWorkerTenantEmailConflict: async () => null, findGlobalWorkerEmailConflict: async () => null,
  findPlatformOwnerEmailConflict: async () => null,
  findStaffTenantEmailConflict: (...args: unknown[]) => mocks.conflict(...args),
}));
vi.mock("@/lib/auth/find-auth-user-by-email", () => ({ findAuthUserIdByEmail: (...args: unknown[]) => mocks.identity(...args) }));
vi.mock("@/lib/admin/staff-roles", async (original) => ({
  ...await original<typeof import("@/lib/admin/staff-roles")>(),
  loadAssignableStaffRoles: async () => ["hr", "manager"].map(key => ({ key, label: key, storageKey: key, aliases: [], isStaff: true, isAssignable: true })),
}));
const args = { tenantId: "tenant-a", actor: { userId: "admin", email: "owner@real-mail.test" }, appOrigin: "https://app.test",
  input: { firstName: "Invited", lastName: "Member", email: "MEMBER@real-mail.test", role: "manager" } };
function client(pendingError: unknown = null, membershipError: unknown = null) {
  return { auth: { admin: { createUser: mocks.create, updateUserById: mocks.update } }, from: (table: string) => {
    const filters: Record<string, unknown> = {};
    const query = { select: () => query, eq: (column: string, value: unknown) => { filters[column] = value; return query; }, ilike: () => query, limit: () => query, insert: mocks.insert,
      maybeSingle: async () => table === "tenants" ? { data: { id: "tenant-a", name: "Tenant A", subdomain: "tenant-a" }, error: null }
        : table === "staff_invitations" ? { data: null, error: pendingError }
        : table === "user_roles" ? { data: null, error: membershipError }
        : { data: filters.tenant_id ? null : { id: "member", tenant_id: "other-tenant", role: "hr" }, error: null } };
    return query;
  } };
}
beforeEach(() => { vi.clearAllMocks(); mocks.conflict.mockResolvedValue(null); mocks.identity.mockResolvedValue(null); });
describe("invitation identity eligibility", () => {
  it("rejects a concurrent membership claim before changing Auth metadata", async () => {
    mocks.identity.mockResolvedValue("member");
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate membership" } });
    await expect(inviteStaff(client() as never, args)).rejects.toMatchObject({ status: 409, code: "DUPLICATE_MEMBERSHIP" });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "member", tenant_id: "tenant-a", role: "manager" }));
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects inviting an existing HR account as Manager without changing its role or password", async () => {
    mocks.conflict.mockResolvedValue({ id: "existing-hr" });
    await expect(inviteStaff(client() as never, args)).rejects.toMatchObject({ status: 409, code: "DUPLICATE_MEMBERSHIP" });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.conflict).toHaveBeenCalledWith(expect.anything(), { tenantId: "tenant-a", email: "member@real-mail.test" });
  });
  it("fails closed when pending-invitation validation fails", async () => {
    const error = { message: "Invitation lookup failed" };
    await expect(inviteStaff(client(error) as never, args)).rejects.toEqual(error);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("fails closed when membership validation fails", async () => {
    mocks.identity.mockResolvedValue("member");
    const error = { message: "Membership lookup failed" };
    await expect(inviteStaff(client(null, error) as never, args)).rejects.toEqual(error);
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
});
