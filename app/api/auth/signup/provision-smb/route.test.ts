import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  updateUserById: vi.fn(),
  fetch: vi.fn(),
  sendEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    auth: { admin: { updateUserById: mocks.updateUserById } },
  }),
}));
vi.mock("@/lib/onboarding/send-owner-onboarding-continuation-email", () => ({ sendOwnerOnboardingContinuationEmail: mocks.sendEmail }));
import { POST } from "./route";

function request(body = {}) {
  return new Request("https://example.com/api/auth/signup/provision-smb", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: "session=owner" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.getUser.mockResolvedValue({ data: { user: {
    id: "owner-1", email: "owner@example.com",
    user_metadata: { company_name: "Example Company", is_staffing_company: true },
    app_metadata: { signup_completed: true },
  } } });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.updateUserById.mockResolvedValue({ error: null });
  mocks.sendEmail.mockResolvedValue({ outcome: "sent" });
  mocks.fetch.mockImplementation(async () => Response.json({ tenantId: "tenant-1" }));
});

describe("Launch Pad workspace provisioning", () => {
  it.each([[true, "Staffing"], [false, "SMB"]])(
    "provisions staffing=%s with the correct category and opens Launch Pad",
    async (isStaffingCompany, category) => {
      const response = await POST(request({ isStaffingCompany }));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ redirectTo: "/admin_recruiter/launch-pad" });
      const [url, options] = mocks.fetch.mock.calls[0];
      expect(url).toBe("https://example.com/api/tenant-onboarding/complete");
      expect(JSON.parse(options.body)).toMatchObject({ category, adminEmail: "owner@example.com" });
      expect(options.headers.cookie).toBe("session=owner");
      expect(mocks.sendEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "owner-1", email: "owner@example.com" }));
      expect(mocks.updateUserById).not.toHaveBeenCalled();
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
      alreadyProvisioned: true, redirectTo: "/admin_recruiter/launch-pad",
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
});
