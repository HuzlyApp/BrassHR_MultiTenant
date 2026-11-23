import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ status: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({
  requireStaffApiSession: async () => ({ authUser: { id: "owner-1" } }),
}));
vi.mock("@/lib/auth/recruiter-onboarding-status.server", () => ({
  resolveRecruiterOnboardingStatus: mocks.status,
}));
vi.mock("@/lib/auth/recruiter-dashboard-redirect", () => ({
  resolveRecruiterRedirectUrl: mocks.redirect,
}));
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.status.mockResolvedValue({
    userId: "owner-1", validTenantAccess: true, godAdmin: false,
    tenantOnboardingCompleted: true, redirectTarget: "/admin_recruiter",
    tenantSubdomain: "example",
    activeTenantId: "tenant-example",
  });
  mocks.redirect.mockImplementation(({ path }) => path);
});

describe("signup destination after staff verification", () => {
  it("replaces stale workspace selection with the validated login destination", async () => {
    const res = await GET(new Request("https://brasshr-devmode.vercel.app/api/auth/recruiter-onboarding-status", {
      headers: { cookie: "onboarding_tenant_slug=previous-workspace" },
    }));
    expect(res.cookies.get("onboarding_tenant_slug")?.value).toBe("example");
    expect(res.headers.get("set-cookie")).toContain("Path=/");
  });

  it("does not change workspace selection after a denied login", async () => {
    mocks.status.mockResolvedValue({ validTenantAccess: false });
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status"));
    expect(res.status).toBe(403);
    expect(res.cookies.get("onboarding_tenant_slug")).toBeUndefined();
  });

  it("preserves a platform administrator's explicit workspace selection", async () => {
    mocks.status.mockResolvedValue({ validTenantAccess: true, godAdmin: true, activeTenantId: "tenant-example", tenantSubdomain: "example" });
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status"));
    expect(res.cookies.get("onboarding_tenant_slug")).toBeUndefined();
  });
  it("preserves Launch Pad for a provisioned staffing owner", async () => {
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status?next=/admin_recruiter/launch-pad"));
    expect(await res.json()).toMatchObject({
      redirectTarget: "/admin_recruiter/launch-pad", redirectUrl: "/admin_recruiter/launch-pad",
    });
  });

  it("preserves the admin home destination after opening the workspace", async () => {
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status?next=/admin_recruiter/home"));
    expect(await res.json()).toMatchObject({ redirectTarget: "/admin_recruiter/home" });
  });

  it("does not accept arbitrary redirect destinations", async () => {
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status?next=https://other.example"));
    expect(await res.json()).toMatchObject({ redirectTarget: "/admin_recruiter" });
  });

  it("requires workspace preparation before Launch Pad", async () => {
    mocks.status.mockResolvedValue({
      userId: "owner-1", validTenantAccess: true, godAdmin: false,
      tenantOnboardingCompleted: false, redirectTarget: "/signup/prepare-workspace",
    });
    const res = await GET(new Request("https://example.com/api/auth/recruiter-onboarding-status?next=/admin_recruiter/launch-pad"));
    expect(await res.json()).toMatchObject({ redirectTarget: "/signup/prepare-workspace" });
  });
});
