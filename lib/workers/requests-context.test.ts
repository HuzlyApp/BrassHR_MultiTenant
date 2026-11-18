import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), staff: vi.fn(), client: vi.fn(), slug: vi.fn(), resolve: vi.fn(), features: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireApiSession: mocks.auth }));
vi.mock("@/lib/scheduling/api-context", () => ({ requireSchedulingContext: mocks.staff, schedulingError: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: mocks.client }));
vi.mock("@/lib/applicant-portal/request", () => ({ readApplicantPortalTenantSlugFromRequest: mocks.slug }));
vi.mock("@/lib/tenant/resolve-tenant-id-by-slug", () => ({ resolveTenantIdBySlug: mocks.resolve }));
vi.mock("@/lib/tenant/edition-features", () => ({ loadTenantFeatures: mocks.features }));
import { requireWorkerRequestContext } from "./requests-context";

function database(profile: unknown = { tenant_id: "tenant-a", is_active: true }, member: unknown = null, workers: unknown[] = [{ id: "worker-a" }]) {
  const filters: Array<[string, string, unknown]> = [];
  mocks.client.mockReturnValue({ from: (table: string) => {
    const result = { data: table === "users" ? profile : table === "user_roles" ? member : table === "worker" ? workers : { id: "tenant-a" }, error: null };
    const chain = { select: () => chain, eq: (k: string, v: unknown) => { filters.push([table,k,v]); return chain; }, order: () => chain,
      maybeSingle: async () => result, then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return chain;
  } });
  return filters;
}
describe("worker request identity and tenant scope", () => {
  it("can reuse identity resolution for timesheets without requiring scheduling features", async () => {
    database();mocks.features.mockResolvedValue({edition:"smb",features:{timesheets:true}});
    expect(await requireWorkerRequestContext(new Request("https://example.test/api/v1/timesheets"),false,false))
      .toMatchObject({tenantId:"tenant-a",ownWorkerIds:["worker-a"]});
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user-a", authUser: { id: "user-a" }, role: "worker", godAdmin: false });
    mocks.features.mockResolvedValue({ edition: "smb", features: { internal_scheduling: true } });
  });
  it("returns unauthenticated denial without creating a database client", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests")) as NextResponse).status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("requires staff authorization for every review", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mocks.staff.mockResolvedValue(denied);
    const request = new Request("https://example.test/api/v1/worker-requests/id/approve", { method: "POST" });
    expect(await requireWorkerRequestContext(request, true)).toBe(denied);
    expect(mocks.staff).toHaveBeenCalledWith(request);
  });
  it("rejects candidates before opening worker request data", async () => {
    mocks.auth.mockResolvedValue({ userId: "user-a", authUser: { id: "user-a" }, role: "candidate", godAdmin: false });
    await expect(
      requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests"))
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.staff).not.toHaveBeenCalled();
  });
  it("scopes worker ownership to both validated tenant and authenticated user", async () => {
    const filters = database();
    const result = await requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests?tenant_id=foreign"));
    expect(result).toMatchObject({ tenantId: "tenant-a", ownWorkerIds: ["worker-a"] });
    expect(filters).toContainEqual(["worker", "tenant_id", "tenant-a"]);
    expect(filters).toContainEqual(["worker", "user_id", "user-a"]);
  });
  it("rejects disabled accounts and suspended memberships", async () => {
    database({ tenant_id: "tenant-a", is_active: false });
    await expect(requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests"))).rejects.toMatchObject({ status: 403 });
    database(undefined, { is_active: false });
    await expect(requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests"))).rejects.toMatchObject({ status: 403 });
  });
  it("does not use a foreign selected tenant without a linked worker", async () => {
    const filters = database(undefined, null, []);
    mocks.slug.mockReturnValue("foreign-company"); mocks.resolve.mockResolvedValue("tenant-b");
    await expect(requireWorkerRequestContext(new Request("https://example.test/api/v1/worker-requests"))).rejects.toMatchObject({ status: 403 });
    expect(filters).toContainEqual(["worker", "tenant_id", "tenant-b"]);
  });
});
