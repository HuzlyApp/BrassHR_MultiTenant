import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
const mocks = vi.hoisted(() => ({ user: vi.fn(), complete: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.user } }) }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ service: true }) }));
vi.mock("@/lib/admin/complete-staff-password-setup", () => ({ completeStaffPasswordSetup: (...args: unknown[]) => mocks.complete(...args) }));
beforeEach(() => { vi.clearAllMocks(); mocks.complete.mockResolvedValue(undefined); });
describe("password setup identity", () => {
  it("uses the verified recovery bearer rather than the admin cookie session", async () => {
    mocks.user.mockImplementation(async (token: string | undefined) => ({ data: { user: token === "hr-recovery" ? { id: "hr", email: "hr@real-mail.test" } : { id: "admin" } }, error: null }));
    const response = await POST(new NextRequest("https://app.test/api/auth/password-setup-complete", { method: "POST", headers: { Authorization: "Bearer hr-recovery" } }));
    expect(response.status).toBe(200);
    expect(mocks.user).toHaveBeenCalledWith("hr-recovery");
    expect(mocks.complete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "hr", email: "hr@real-mail.test" }));
  });
  it("does not fall back to cookies when the supplied bearer is rejected", async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: { message: "Invalid JWT" } });
    const response = await POST(new NextRequest("https://app.test/api/auth/password-setup-complete", { method: "POST", headers: { Authorization: "Bearer invalid" } }));
    expect(response.status).toBe(401); expect(mocks.complete).not.toHaveBeenCalled(); expect(mocks.user).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed authorization without accepting an admin cookie", async () => {
    const response = await POST(new NextRequest("https://app.test/api/auth/password-setup-complete", { method: "POST", headers: { Authorization: "Basic admin" } }));
    expect(response.status).toBe(401); expect(mocks.user).not.toHaveBeenCalled(); expect(mocks.complete).not.toHaveBeenCalled();
  });
});
