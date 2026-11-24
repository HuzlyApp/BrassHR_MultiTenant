import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const id = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), tenant: vi.fn(), access: vi.fn(), from: vi.fn(), filters: [] as Array<[string, string, unknown]>, signed: vi.fn(), workerFound: true }));
vi.mock("@/lib/auth/api-session", () => ({ requireStaffApiSession: mocks.auth }));
vi.mock("@/lib/jobs/tenant", () => ({ resolveStaffTenantId: mocks.tenant }));
vi.mock("@/lib/auth/worker-record-access", () => ({ canAccessWorkerRecord: mocks.access }));
vi.mock("@/lib/supabase-env", () => ({ getSupabaseUrl: () => "https://qa.supabase.co" }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.signed }) } }) }));
vi.mock("@/lib/audit/activity-log", () => ({ writeActivityLog: vi.fn() }));
vi.mock("@/lib/applicant-portal/worker-profile-photo", () => ({ resolveWorkerProfilePhotoUrl: async () => null }));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "qa-test-key");
  mocks.workerFound = true; mocks.filters = [];
  mocks.auth.mockResolvedValue({ userId: "staff", authUser: { id: "staff" }, role: "admin", devBypass: false });
  mocks.tenant.mockResolvedValue("tenant-a"); mocks.access.mockResolvedValue(true);
  mocks.signed.mockResolvedValue({ data: { signedUrl: "https://qa.test/resume.pdf" }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const result = () => ({ data: table === "worker" ? mocks.workerFound ? { id, tenant_id: "tenant-a", first_name: "QA", last_name: "Applicant", status: "new", ssn: "must-not-be-returned" } : null : [{ resume_path: "tenant-a/resume.pdf" }], error: null });
    const query = { select: () => query, eq: (key: string, value: unknown) => { mocks.filters.push([table, key, value]); return query; }, or: () => query, limit: () => query,
      maybeSingle: async () => result(), then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve) };
    return query;
  });
});
const request = () => new NextRequest(`https://qa.test/api/admin/worker-profile?workerId=${id}&view=resume`);
describe("compact resume profile projection", () => {
  it("returns the resume before loading document scans or onboarding progress and excludes unrelated private fields", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.worker.first_name).toBe("QA");
    expect(payload.requirements.resume_url).toBe("https://qa.test/resume.pdf");
    expect(payload.worker.ssn).toBeUndefined();
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["worker", "worker_requirements"]);
    expect(mocks.filters).toContainEqual(["worker", "tenant_id", "tenant-a"]);
    expect(mocks.filters).toContainEqual(["worker_requirements", "tenant_id", "tenant-a"]);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("fails closed when no tenant is selected", async () => {
    mocks.tenant.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not sign a resume for an inaccessible candidate", async () => {
    mocks.access.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(403);
    expect(mocks.signed).not.toHaveBeenCalled();
  });
  it("returns 404 for a candidate outside the tenant query", async () => {
    mocks.workerFound = false;
    expect((await GET(request())).status).toBe(404);
    expect(mocks.signed).not.toHaveBeenCalled();
  });
  it("requires a staff session before reading candidate data", async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
