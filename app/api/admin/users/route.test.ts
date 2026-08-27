import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireStaffApiSession = vi.fn();
const requireUserManagement = vi.fn();
const resolveStaffTenantId = vi.fn();
const listStaffDirectory = vi.fn();
const inviteStaff = vi.fn();
const createServiceRoleClient = vi.fn();
const enforceRateLimit = vi.fn();
const resolveAppOrigin = vi.fn();

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
  listStaffDirectory: (...args: unknown[]) => listStaffDirectory(...args),
  inviteStaff: (...args: unknown[]) => inviteStaff(...args),
  staffDirectoryErrorResponse: (error: unknown) => ({
    error: error instanceof Error ? error.message : "error",
    code: "INTERNAL",
    status: 500,
  }),
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
  getClientIp: () => "127.0.0.1",
}));

vi.mock("@/lib/resolve-app-origin", () => ({
  resolveAppOrigin: (...args: unknown[]) => resolveAppOrigin(...args),
}));

vi.mock("@/lib/tenant/tenant-host-resolution", () => ({
  getEffectiveRootDomain: () => "brasshr.com",
}));

const adminAuth = {
  userId: "admin-1",
  email: "owner@example.com",
  role: "admin",
  godAdmin: false,
  authUser: { id: "admin-1", app_metadata: { tenant_id: "tenant-1" } },
};

const recruiterAuth = {
  ...adminAuth,
  userId: "recruiter-1",
  role: "recruiter",
  authUser: { id: "recruiter-1", app_metadata: { tenant_id: "tenant-1" } },
};

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServiceRoleClient.mockReturnValue({ from: vi.fn() });
    resolveStaffTenantId.mockResolvedValue("tenant-1");
    enforceRateLimit.mockResolvedValue(null);
    resolveAppOrigin.mockReturnValue("http://localhost:3000");
    requireUserManagement.mockReturnValue(null);
  });

  it("lets an authorized admin list users", async () => {
    requireStaffApiSession.mockResolvedValue(adminAuth);
    listStaffDirectory.mockResolvedValue([]);
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.canManage).toBe(true);
    expect(body.users).toEqual([]);
  });

  it("rejects recruiters on the list endpoint", async () => {
    requireStaffApiSession.mockResolvedValue(recruiterAuth);
    requireUserManagement.mockReturnValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    expect(response.status).toBe(403);
    expect(listStaffDirectory).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    requireStaffApiSession.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("invites a recruiter for an authorized admin", async () => {
    requireStaffApiSession.mockResolvedValue(adminAuth);
    inviteStaff.mockResolvedValue({
      row: { id: "member:new", email: "ada@example.com", status: "pending", role: "recruiter" },
      existingAccount: false,
    });
    const { POST } = await import("@/app/api/admin/users/route");
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.com",
          role: "recruiter",
        }),
      }) as never
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.user.status).toBe("pending");
    expect(inviteStaff).toHaveBeenCalled();
  });

  it("does not invite when a recruiter calls the endpoint directly", async () => {
    requireStaffApiSession.mockResolvedValue(recruiterAuth);
    requireUserManagement.mockReturnValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const { POST } = await import("@/app/api/admin/users/route");
    const response = await POST(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: "ada@example.com" }),
      }) as never
    );
    expect(response.status).toBe(403);
    expect(inviteStaff).not.toHaveBeenCalled();
  });
});
