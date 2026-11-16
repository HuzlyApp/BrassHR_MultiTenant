import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), staff: vi.fn(), manage: vi.fn(), tenant: vi.fn(), client: vi.fn(),
}));
vi.mock("@/lib/auth/api-session", () => ({ requireApiSession: mocks.session, requireStaffApiSession: mocks.staff }));
vi.mock("@/lib/auth/user-management", () => ({ requireUserManagement: mocks.manage }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: mocks.tenant }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: mocks.client }));
import { requireEditionContext } from "./edition-api-context";

const staff = { userId: "user-a", role: "recruiter", godAdmin: false, authUser: { id: "user-a" } };

describe("edition API tenant authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue(staff);
    mocks.staff.mockResolvedValue(staff);
    mocks.manage.mockResolvedValue(null);
    mocks.client.mockReturnValue({});
    mocks.tenant.mockResolvedValue("authorized-tenant");
  });

  it("rejects unauthenticated requests before creating an elevated client", async () => {
    mocks.session.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await requireEditionContext(new Request("https://example.test/api/v1/tenants/me/features")) as NextResponse).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("ignores a client-provided tenant id and uses validated server scope", async () => {
    const result = await requireEditionContext(new Request("https://example.test/api/v1/tenants/me/features?tenant_id=foreign"));
    expect(result).toMatchObject({ tenantId: "authorized-tenant" });
  });

  it("rejects invalid or foreign tenant selections without a fallback", async () => {
    mocks.tenant.mockResolvedValue(null);
    const result = await requireEditionContext(new Request("https://example.test/api/v1/tenants/me/features"));
    expect((result as NextResponse).status).toBe(403);
  });

  it("requires the existing management grant before obtaining an elevated client", async () => {
    mocks.manage.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const request = new Request("https://example.test/api/v1/tenants/me/edition", { method: "PATCH" });
    expect((await requireEditionContext(request, true) as NextResponse).status).toBe(403);
    expect(mocks.staff).toHaveBeenCalledWith(request);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("rejects disabled workers even when they have a profile tenant", async () => {
    mocks.session.mockResolvedValue({ ...staff, role: "worker" });
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { tenant_id: "tenant-a", is_active: false }, error: null }),
    };
    mocks.client.mockReturnValue({ from: vi.fn().mockReturnValue(query) });
    expect((await requireEditionContext(new Request("https://example.test/api/v1/tenants/me/features")) as NextResponse).status).toBe(403);
    expect(query.eq).toHaveBeenCalledWith("id", "user-a");
  });
});
