import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ library: vi.fn(), from: vi.fn(), filters: [] as Array<[string, string, unknown]> }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: async () => ({ userId: "staff", role: "admin" }) }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: async () => "tenant-a" }));
vi.mock("@/lib/onboarding/onboarding-libraries", () => ({ resolveOnboardingLibraryForFlows: mocks.library }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: mocks.from }) }));
import { GET } from "./route";
beforeEach(() => {
  mocks.filters = []; mocks.library.mockReset().mockResolvedValue({ id: "library-a" });
  mocks.from.mockReset().mockImplementation((table: string) => {
    const query = { select: () => query, eq: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; }, or: () => query, order: () => query,
      maybeSingle: async () => ({ data: { id: "tenant-a", name: "QA company" }, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === "onboarding_flows" ? [{ id: "flow-a", name: "Published workflow" }] : [], error: null }).then(resolve) };
    return query;
  });
});
describe("published workflow override options", () => {
  it("uses the same tenant and default library as the Workflows list", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).workflows).toEqual([{ id: "flow-a", name: "Published workflow" }]);
    expect(mocks.filters).toContainEqual(["onboarding_flows", "tenant_id", "tenant-a"]);
    expect(mocks.filters).toContainEqual(["onboarding_flows", "library_id", "library-a"]);
    expect(mocks.filters).toContainEqual(["onboarding_flows", "status", "published"]);
  });
  it("does not fall back to unrelated tenant libraries when the default library is missing", async () => {
    mocks.library.mockResolvedValue(null);
    const response = await GET();
    expect((await response.json()).workflows).toEqual([]);
    expect(mocks.from).not.toHaveBeenCalledWith("onboarding_flows");
  });
});
