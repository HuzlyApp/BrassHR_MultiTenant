import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ from: vi.fn(), start: vi.fn(), worker: vi.fn(), tenant: vi.fn(), questions: vi.fn(), calls: [] as Array<[string, ...unknown[]]> }));
vi.mock("@/lib/onboarding/request-access", () => ({ authorizeOnboardingRequest: async () => null }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/supabase-env", () => ({ getSupabaseUrl: () => "https://example.supabase.co" }));
vi.mock("@/lib/jobs/service", () => ({ startOrResumeJobApplication: mocks.start }));
vi.mock("@/lib/jobs/tenant", () => ({ resolvePublicTenant: mocks.tenant }));
vi.mock("@/lib/onboarding/resolve-onboarding-worker", () => ({ resolveOnboardingWorker: mocks.worker, readOnboardingTenantSlugFromRequest: () => "acme" }));
vi.mock("@/lib/jobs/screening-questions", () => ({ loadJobScreeningQuestions: mocks.questions, mergeApplicationScreeningViews: ({ questions }: { questions: unknown[] }) => questions, loadApplicationScreeningContext: vi.fn(), upsertApplicationScreeningAnswers: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.calls.length = 0; vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-placeholder"); mocks.tenant.mockResolvedValue({ id: "tenant-a" }); mocks.questions.mockResolvedValue([{ id: "q-a", isRequired: true }]);
  const query = { select: () => query, eq: (...args: unknown[]) => { mocks.calls.push(["eq", ...args]); return query; }, in: (...args: unknown[]) => { mocks.calls.push(["in", ...args]); return query; }, maybeSingle: async () => ({ data: { id: "job-a", public_title: "Nurse" }, error: null }) };
  mocks.from.mockReturnValue(query);
});
describe("job screening draft preview", () => {
  it("loads tenant-scoped published questions without resolving or creating an applicant", async () => {
    const result = await GET(new NextRequest("https://brasshr.test/api/onboarding/job-screening-answers?applicantId=draft-preview&tenantSlug=acme&jobToken=token-a"));
    expect(result.status).toBe(200); expect(await result.json()).toMatchObject({ applicationId: null, jobTitle: "Nurse", hasQuestions: true });
    expect(mocks.calls).toContainEqual(["eq", "tenant_id", "tenant-a"]);
    expect(mocks.calls).toContainEqual(["eq", "public_job_token", "token-a"]);
    expect(mocks.calls.some(([method, field]) => method === "in" && field === "status")).toBe(true);
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.worker).not.toHaveBeenCalled();
  });
});
