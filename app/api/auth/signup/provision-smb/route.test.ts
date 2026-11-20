import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  updateUserById: vi.fn(),
  fetch: vi.fn(),
  sendEmail: vi.fn(),
  refreshSession: vi.fn(),
  generateLink: vi.fn(),
  tenant: vi.fn(),
  saveTenant: vi.fn(),
  register: vi.fn(),
  verified: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser, refreshSession: mocks.refreshSession } }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: table === "users" ? mocks.maybeSingle : mocks.tenant }) }),
      update: () => ({ eq: () => ({ select: () => ({ maybeSingle: mocks.saveTenant }) }) }),
    }),
    auth: { admin: { updateUserById: mocks.updateUserById, generateLink: mocks.generateLink } },
  }),
}));
vi.mock("@/lib/onboarding/send-owner-onboarding-continuation-email", () => ({ sendOwnerOnboardingContinuationEmail: mocks.sendEmail }));
vi.mock("@/lib/vercel", () => ({ registerTenantDomain: mocks.register }));
vi.mock("@/lib/tenant/invalidate-tenant-branding-cache", () => ({ invalidateTenantBrandingCache: vi.fn() }));
vi.mock("@/lib/auth/staff-session-verification", () => ({ hasVerifiedStaffSession: mocks.verified }));
import { STAFF_SESSION_PROOF_COOKIE, verifyStaffSessionProof } from "@/lib/auth/login-otp-proof";
import { POST } from "./route";

function request(body = {}, origin = "https://brasshr.com") {
  return new Request(`${origin}/api/auth/signup/provision-smb`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "session=owner" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ROOT_DOMAIN", "brasshr.com");
  vi.stubEnv("LOGIN_OTP_PROOF_SECRET", "test-session-proof-secret");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.getUser.mockResolvedValue({ data: { user: {
    id: "owner-1", email: "owner@example.com",
    created_at: new Date().toISOString(),
    user_metadata: { company_name: "Example Company", is_staffing_company: true },
    app_metadata: { signup_completed: true },
  } } });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
  mocks.sendEmail.mockResolvedValue({ outcome: "sent" });
  mocks.register.mockResolvedValue({ skipped: false, domain: { verified: true } });
  mocks.refreshSession.mockResolvedValue({ data: { session: { access_token: `header.${Buffer.from(JSON.stringify({ sub: "owner-1", session_id: "session-1", aal: "aal1" })).toString("base64url")}.signature` } }, error: null });
  mocks.generateLink.mockResolvedValue({ data: { user: { id: "owner-1" }, properties: { hashed_token: "one-time-token" } }, error: null });
  mocks.saveTenant.mockResolvedValue({ data: { id: "tenant-1" }, error: null });
  mocks.tenant.mockResolvedValue({ data: { id: "tenant-1", slug: "workspace-existing", subdomain: "workspace-existing", is_active: true }, error: null });
  mocks.fetch.mockImplementation(async (_url, options) => {
    const { subdomain } = JSON.parse(options.body);
    mocks.maybeSingle.mockResolvedValue({ data: { tenant_id: "tenant-1", role: "admin" }, error: null });
    mocks.tenant.mockResolvedValue({ data: { id: "tenant-1", slug: subdomain, subdomain, is_active: true }, error: null });
    return Response.json({ tenantId: "tenant-1" });
  });
});

describe("Launch Pad workspace provisioning", () => {
  it.each([[true, "Staffing"], [false, "SMB"]])(
    "provisions staffing=%s with the correct category and opens Launch Pad",
    async (isStaffingCompany, category) => {
      const response = await POST(request({ isStaffingCompany }));
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.subdomain).toMatch(/^workspace-[a-f0-9]{16}$/);
      expect(payload.workspaceUrl).toBe(`https://${payload.subdomain}.brasshr.com/admin_recruiter/launch-pad`);
      expect(payload.redirectTo).toBe(`https://${payload.subdomain}.brasshr.com/auth/callback/workspace?token_hash=one-time-token`);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const [url, options] = mocks.fetch.mock.calls[0];
      expect(url).toBe("https://brasshr.com/api/tenant-onboarding/complete");
      expect(JSON.parse(options.body)).toMatchObject({ category, adminEmail: "owner@example.com" });
      expect(options.headers.cookie).toBe("session=owner");
      expect(mocks.sendEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "owner-1", email: "owner@example.com" }));
      expect(mocks.updateUserById).not.toHaveBeenCalled();
      expect(mocks.register).toHaveBeenCalledWith(payload.subdomain, { origin: "https://brasshr.com" });
    }
  );

  it("recovers a legacy staffing signup from its account metadata", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).category).toBe("Staffing");
  });

  it("does not provision a second workspace for an existing owner", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: {
      tenant_id: "tenant-1", onboarding_completed: true, role: "admin",
    }, error: null });
    expect(await (await POST(request())).json()).toMatchObject({
      alreadyProvisioned: true, workspaceUrl: "https://workspace-existing.brasshr.com/admin_recruiter/launch-pad",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps waitlisted owners out of workspace provisioning", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { signup_waitlist_pending: true }, error: null });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("fails closed if workspace status cannot be read", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("requires an authenticated owner", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request())).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps development on its current host and refreshes the admin session", async () => {
    mocks.register.mockResolvedValue({ skipped: true });
    const res = await POST(request({}, "https://brasshr-devmode.vercel.app"));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.redirectTo).toBe(`https://brasshr-devmode.vercel.app/admin_recruiter/launch-pad?tenant=${payload.subdomain}`);
    expect(mocks.refreshSession).toHaveBeenCalledOnce();
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(verifyStaffSessionProof("owner-1", "session-1", res.cookies.get(STAFF_SESSION_PROOF_COOKIE)?.value)).toBe(true);
  });

  it("retries random-name collisions with a new random name", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ error: "Subdomain already taken" }, { status: 409 }));
    const res = await POST(request());
    expect(res.status).toBe(200);
    const names = mocks.fetch.mock.calls.map(([, options]) => JSON.parse(options.body).subdomain);
    expect(new Set(names).size).toBe(2);
  });

  it("does not redirect to an unconnected production domain", async () => {
    mocks.register.mockResolvedValue({ skipped: true });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).not.toHaveProperty("redirectTo");
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("rejects a session handoff generated for a different identity", async () => {
    mocks.generateLink.mockResolvedValue({ data: { user: { id: "someone-else" }, properties: { hashed_token: "token" } }, error: null });
    expect((await POST(request())).status).toBe(503);
  });
  it("does not bypass staff verification for an older account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner-1", email: "owner@example.com", created_at: "2020-01-01T00:00:00Z" } } });
    mocks.verified.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
