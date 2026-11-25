import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ authUser: { id: "staff-user" } }) }));
vi.mock("@/lib/auth/staff-tenant-scope", () => ({ resolveStaffTenantScope: async () => ({ mode: "scoped", tenantId: "tenant" }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => ({ insert: mocks.insert }) }) }));
beforeEach(() => { mocks.insert.mockReset().mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "new-client" }, error: null }) }) }); });
const request = (companyName: string) => new NextRequest("https://example.com/api/admin/clients", { method: "POST", body: JSON.stringify({ companyName }) });
describe("staff-created client organizations", () => {
  it("does not reuse the staff login as the client's unique account", async () => {
    expect((await POST(request("Client One"))).status).toBe(201);
    expect((await POST(request("Client Two"))).status).toBe(201);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: "tenant", user_id: null }));
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ verification_status: "pending", onboarding_status: "pending", onboarding_completed_at: null }));
  });
  it.each(["", "A", "<script>x</script> Client", "x".repeat(121)])("rejects invalid company names before inserting", async (name) => {
    expect((await POST(request(name))).status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
