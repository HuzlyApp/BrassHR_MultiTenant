import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  getUser: vi.fn(), link: vi.fn(), update: vi.fn(),
}));
vi.mock("@/lib/auth/staff-session-verification", () => ({ hasVerifiedStaffSession: async () => true }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: state.getUser } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: () => ({ update: () => ({ eq: state.update }) }) }) }));
vi.mock("@/lib/supabase-env", () => ({ getSupabaseUrl: () => "https://example.supabase.co" }));
vi.mock("@/lib/onboarding/owner-onboarding-continuation-link", () => ({ findOwnerContinuationLinkByToken: state.link }));
vi.mock("@/lib/audit/activity-log", () => ({ writeActivityLog: vi.fn() }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  state.link.mockResolvedValue({ id: "link-1", user_id: "owner-1", email: "owner@example.com", target_path: "/tenant-onboarding", expires_at: new Date(Date.now() + 60000).toISOString(), revoked_at: null });
  state.getUser.mockResolvedValue({ data: { user: null } });
});

const request = () => new NextRequest("https://brasshr.com/tenant-onboarding/continue?token=test-token");
describe("owner welcome email destination", () => {
  it("prefills the signup email and returns signed-out owners to Launch Pad after sign-in", async () => {
    const response = await GET(request());
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin");
    expect(location.searchParams.get("email")).toBe("owner@example.com");
    expect(location.searchParams.get("next")).toBe("/admin_recruiter/launch-pad");
    expect(location.searchParams.has("token")).toBe(false);
  });

  it("opens Launch Pad directly for the signed-in owner, even for an old wizard link", async () => {
    state.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
    expect((await GET(request())).headers.get("location")).toBe("https://brasshr.com/admin_recruiter/launch-pad");
  });

  it("requires the correct owner to sign in when another account is active", async () => {
    state.getUser.mockResolvedValue({ data: { user: { id: "other-owner" } } });
    expect(new URL((await GET(request())).headers.get("location")!).pathname).toBe("/admin");
  });

  it("rejects expired email links", async () => {
    state.link.mockResolvedValue({ id: "link-1", expires_at: new Date(0).toISOString(), revoked_at: null });
    expect(new URL((await GET(request())).headers.get("location")!).searchParams.get("code")).toBe("expired");
    expect(state.getUser).not.toHaveBeenCalled();
  });
});
