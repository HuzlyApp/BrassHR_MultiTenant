import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), tenant: vi.fn(), rpc: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: mocks.tenant }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => {
  const query = { select: () => query, eq: (...args: unknown[]) => { mocks.eq(...args); return query; }, then: (resolve: (data: unknown) => unknown) => Promise.resolve({ data: [{ status: "new", created_at: "2026-11-01" }], error: null }).then(resolve) };
  return { from: () => query, rpc: mocks.rpc };
} }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "staff" }); mocks.tenant.mockResolvedValue("tenant-a"); mocks.rpc.mockResolvedValue({ data: { total: 31 }, error: null }); });
describe("applicant metric total", () => {
  it("uses the same unique-applicant total as the tenant-scoped table", async () => {
    const response = await GET(new NextRequest("https://app.test/api/admin/job-applications/metrics"));
    expect(response.status).toBe(200);
    expect((await response.json()).timeframes.all_time.total).toBe(31);
    expect(mocks.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(mocks.rpc).toHaveBeenCalledWith("staff_application_list_page", expect.objectContaining({ p_tenant_id: "tenant-a", p_job_id: null, p_limit: 1 }));
  });
  it("preserves a validated job scope for the metric and list total", async () => {
    const jobId = "6182a4fb-7b03-4f33-9a17-d069c1c85009";
    await GET(new NextRequest(`https://app.test/api/admin/job-applications/metrics?jobId=${jobId}`));
    expect(mocks.eq).toHaveBeenCalledWith("job_requisition_id", jobId);
    expect(mocks.rpc).toHaveBeenCalledWith("staff_application_list_page", expect.objectContaining({ p_job_id: jobId }));
  });
  it("does not report a false zero when the grouped count fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Count unavailable") });
    expect((await GET(new NextRequest("https://app.test/api/admin/job-applications/metrics"))).status).toBe(500);
  });
});
