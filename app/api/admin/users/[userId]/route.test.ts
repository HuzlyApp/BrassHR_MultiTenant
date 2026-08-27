import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireStaffApiSession = vi.fn();
const requireUserManagement = vi.fn();
const resolveStaffTenantId = vi.fn();
const updateStaffMembership = vi.fn();
const removeStaffMembership = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: (...args: unknown[]) => requireStaffApiSession(...args),
}));

vi.mock("@/lib/auth/user-management", () => ({
  requireUserManagement: (...args: unknown[]) => requireUserManagement(...args),
}));

vi.mock("@/lib/jobs/tenant", () => ({
  resolveStaffTenantId: (...args: unknown[]) => resolveStaffTenantId(...args),
}));

vi.mock("@/lib/admin/staff-directory", () => ({
  updateStaffMembership: (...args: unknown[]) => updateStaffMembership(...args),
  removeStaffMembership: (...args: unknown[]) => removeStaffMembership(...args),
  staffDirectoryErrorResponse: (error: unknown) => ({
    error: error instanceof Error ? error.message : "error",
    code: "INTERNAL",
    status: 500,
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

const adminAuth = {
  userId: "admin-1",
  email: "owner@example.com",
  role: "admin",
  godAdmin: false,
  authUser: { id: "admin-1" },
};

describe("/api/admin/users/[userId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServiceRoleClient.mockReturnValue({});
    resolveStaffTenantId.mockResolvedValue("tenant-1");
    requireStaffApiSession.mockResolvedValue(adminAuth);
    requireUserManagement.mockReturnValue(null);
  });

  it("suspends a member in the caller tenant only", async () => {
    updateStaffMembership.mockResolvedValue({ id: "member:user-2", status: "suspended" });
    const { PATCH } = await import("@/app/api/admin/users/[userId]/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ action: "suspend" }),
      }) as never,
      { params: Promise.resolve({ userId: "user-2" }) }
    );
    expect(response.status).toBe(200);
    expect(updateStaffMembership).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-1", userId: "user-2", action: "suspend" })
    );
  });

  it("rejects recruiter callers", async () => {
    requireStaffApiSession.mockResolvedValue({ ...adminAuth, role: "recruiter" });
    requireUserManagement.mockReturnValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const { PATCH } = await import("@/app/api/admin/users/[userId]/route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify({ action: "suspend" }),
      }) as never,
      { params: Promise.resolve({ userId: "user-2" }) }
    );
    expect(response.status).toBe(403);
    expect(updateStaffMembership).not.toHaveBeenCalled();
  });

  it("removes membership without deleting the auth identity", async () => {
    removeStaffMembership.mockResolvedValue(undefined);
    const { DELETE } = await import("@/app/api/admin/users/[userId]/route");
    const response = await DELETE(
      new Request("http://localhost/api/admin/users/user-2", { method: "DELETE" }) as never,
      { params: Promise.resolve({ userId: "user-2" }) }
    );
    expect(response.status).toBe(200);
    expect(removeStaffMembership).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: "tenant-1", userId: "user-2" })
    );
  });
});
