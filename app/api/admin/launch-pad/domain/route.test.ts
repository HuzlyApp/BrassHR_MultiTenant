import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), load: vi.fn(), save: vi.fn(), update: vi.fn(), filter: vi.fn(), available: vi.fn(), register: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/email-templates/resolve-effective-tenant", () => ({ resolveEffectiveAdminTenantId: mocks.scope }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: mocks.load }) }),
  update: (data: unknown) => { mocks.update(data); return { eq: (...args: unknown[]) => { mocks.filter(...args); return { select: () => ({ maybeSingle: mocks.save }) }; } }; },
}) }) }));
vi.mock("@/lib/tenant/check-subdomain-availability", () => ({ checkSubdomainAvailabilityForOnboarding: mocks.available }));
vi.mock("@/lib/vercel", () => ({ registerTenantDomain: mocks.register }));
vi.mock("@/lib/tenant/invalidate-tenant-branding-cache", () => ({ invalidateTenantBrandingCache: mocks.invalidate }));
vi.mock("@/lib/cache", () => ({ buildCacheKey: () => "test-key", deleteCache: vi.fn() }));
import { GET, PATCH } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ROOT_DOMAIN", "brasshr.test");
  mocks.auth.mockResolvedValue({ role: "admin", userId: "owner-1", godAdmin: false });
  mocks.scope.mockResolvedValue("tenant-1");
  mocks.load.mockResolvedValue({ data: { id: "tenant-1", slug: "original-company", subdomain: "original-company" }, error: null });
  mocks.save.mockResolvedValue({ data: { id: "tenant-1" }, error: null });
  mocks.available.mockResolvedValue({ ok: true, subdomain: "chosen-company" });
  mocks.register.mockResolvedValue({ skipped: true });
});
const request = (subdomain = "chosen-company") => new Request("https://brasshr.test/api/admin/launch-pad/domain", { method: "PATCH", body: JSON.stringify({ subdomain, tenantId: "untrusted-tenant" }) });

describe("tenant admin Launch Pad domain", () => {
  it("returns development links with the saved slug even after changing the subdomain", async () => {
    const res = await PATCH(new Request("https://brasshr-devmode.vercel.app/api/admin/launch-pad/domain", {
      method: "PATCH", body: JSON.stringify({ subdomain: "chosen-company" }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ usesTenantQuery: true, workspaceUrl: "https://brasshr-devmode.vercel.app/admin_recruiter/home?tenant=original-company" });
    expect(mocks.register).toHaveBeenCalledWith("chosen-company", { origin: "https://brasshr-devmode.vercel.app" });
    expect(await (await GET(new Request("https://brasshr-devmode.vercel.app/api/admin/launch-pad/domain"))).json())
      .toMatchObject({ workspaceUrl: "https://brasshr-devmode.vercel.app/admin_recruiter/home?tenant=original-company" });
  });
  it("saves only the resolved tenant and returns its workspace URL", async () => {
    const res = await PATCH(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ workspaceUrl: "https://chosen-company.brasshr.test/admin_recruiter/home" });
    expect(mocks.filter).toHaveBeenCalledWith("id", "tenant-1");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ subdomain: "chosen-company", domain: "chosen-company.brasshr.test" }));
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("slug");
    expect(mocks.available).toHaveBeenCalledWith(expect.anything(), "chosen-company", "tenant-1");
  });
  it("loads the saved workspace address for the completion modal", async () => {
    expect(await (await GET()).json()).toMatchObject({ workspaceUrl: "https://original-company.brasshr.test/admin_recruiter/home" });
  });
  it("rejects non-admin staff", async () => {
    mocks.auth.mockResolvedValue({ role: "recruiter", godAdmin: false });
    expect((await PATCH(request())).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("requires a validated tenant scope", async () => {
    mocks.scope.mockResolvedValue(null);
    expect((await PATCH(request())).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects reserved subdomains", async () => {
    expect((await PATCH(request("admin"))).status).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it("rejects domains owned by other tenants", async () => {
    mocks.available.mockResolvedValue({ error: "Already taken" });
    expect((await PATCH(request())).status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps the saved address when domain registration fails", async () => {
    mocks.register.mockRejectedValue(new Error("unavailable"));
    expect((await PATCH(request())).status).toBe(502);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("handles a concurrent domain claim without reporting success", async () => {
    mocks.save.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect((await PATCH(request())).status).toBe(409);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
