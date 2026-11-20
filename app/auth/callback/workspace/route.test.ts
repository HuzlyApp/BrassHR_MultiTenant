import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { STAFF_SESSION_PROOF_COOKIE, verifyStaffSessionProof } from "@/lib/auth/login-otp-proof";
const mocks = vi.hoisted(() => ({ verify: vi.fn(), owner: vi.fn(), tenant: vi.fn(), cookies: undefined as undefined | { setAll: (values: Array<{ name: string; value: string; options: { path: string } }>) => void } }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: typeof mocks.cookies }) => {
  mocks.cookies = options.cookies;
  return { auth: { verifyOtp: mocks.verify } };
} }));
vi.mock("@/lib/supabase-env", () => ({ getSupabaseUrl: () => "https://supabase.example", getSupabaseAnonKey: () => "public-key" }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: table === "users" ? mocks.owner : mocks.tenant }) }) }) }) }));
import { GET } from "./route";
const request = (query = "token_hash=one-time-token", hostname = "workspace-123.brasshr.com") => new NextRequest(`https://${hostname}/auth/callback/workspace?${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ROOT_DOMAIN", "brasshr.com");
  vi.stubEnv("LOGIN_OTP_PROOF_SECRET", "test-session-proof-secret");
  mocks.verify.mockImplementation(async () => {
    mocks.cookies?.setAll([{ name: "sb-session", value: "session", options: { path: "/" } }]);
    return { data: { user: { id: "owner-1" }, session: { access_token: `header.${Buffer.from(JSON.stringify({ sub: "owner-1", session_id: "session-1", aal: "aal1" })).toString("base64url")}.signature` } }, error: null };
  });
  mocks.owner.mockResolvedValue({ data: { tenant_id: "tenant-1", role: "admin", is_active: true }, error: null });
  mocks.tenant.mockResolvedValue({ data: { subdomain: "workspace-123", domain: "workspace-123.brasshr.com", is_active: true }, error: null });
});

describe("signup admin sign-in on the tenant host", () => {
  it("redeems the one-time token, returns host-only cookies and removes the token from the redirect", async () => {
    const res = await GET(request());
    expect(res.headers.get("location")).toBe("https://workspace-123.brasshr.com/admin_recruiter/launch-pad");
    expect(res.cookies.get("sb-session")?.value).toBe("session");
    expect(verifyStaffSessionProof("owner-1", "session-1", res.cookies.get(STAFF_SESSION_PROOF_COOKIE)?.value)).toBe(true);
    expect(res.headers.get("set-cookie")).not.toMatch(/Domain=/i);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.verify).toHaveBeenCalledWith({ token_hash: "one-time-token", type: "email" });
  });
  it("does not sign a tenant's admin into another tenant's host", async () => {
    const res = await GET(request("token_hash=one-time-token", "other.brasshr.com"));
    expect(res.headers.get("location")).toContain("/admin?error=workspace_signin");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("rejects non-admin identities without returning their session cookies", async () => {
    mocks.owner.mockResolvedValue({ data: { tenant_id: "tenant-1", role: "recruiter" }, error: null });
    const res = await GET(request());
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toContain("workspace_signin");
  });
  it("rejects expired or already-used tokens", async () => {
    mocks.verify.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Expired" } });
    const res = await GET(request());
    expect(res.headers.get("location")).toContain("workspace_signin");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it("does not bypass an enrolled MFA factor", async () => {
    mocks.verify.mockResolvedValue({ data: { user: { id: "owner-1", factors: [{ status: "verified" }] }, session: { access_token: `header.${Buffer.from(JSON.stringify({ sub: "owner-1", session_id: "session-1", aal: "aal1" })).toString("base64url")}.signature` } }, error: null });
    const res = await GET(request());
    expect(res.headers.get("location")).toContain("workspace_signin");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
  it.each([["", "workspace-123.brasshr.com"], ["token_hash=token", "evil.example"]])("rejects missing tokens or an unrelated host", async (query, hostname) => {
    const res = await GET(request(query, hostname));
    expect(res.headers.get("location")).toContain("workspace_signin");
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
