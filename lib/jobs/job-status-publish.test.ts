import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/service-area/jobs", () => ({ evaluateJobServiceArea: vi.fn(async () => ({})), requireApplyWorkLocation: vi.fn() }));
vi.mock("@/lib/onboarding/onboarding-flows", () => ({ getOnboardingFlowById: vi.fn(async () => ({ status: "published", builderDraft: { nodes: [{ id: "step" }] } })) }));
import { publishExistingJob, transitionJobStatus } from "./service";

const valid = { id: "job-a", status: "draft", published_at: null, source_type: "Internal", employment_type: "W2", public_title: "Nurse", public_description: "Provide nursing care.", pay_rate_min: 25, pay_rate_period: "Hourly", location: "Austin, TX", shift_type: "Full-time", profession_id: "profession-a", workflow_id: "assigned-flow", workflow_assignment_mode: "manual" };
function database(row: Record<string, unknown>) {
  const patch = vi.fn();
  const filters: unknown[][] = [];
  const query = { select: () => query, eq: (...args: unknown[]) => { filters.push(args); return query; }, maybeSingle: async () => ({ data: row, error: null }), update: (value: unknown) => { patch(value); return query; }, single: async () => ({ data: { ...row, ...patch.mock.calls.at(-1)?.[0] }, error: null }) };
  return { db: { from: () => query }, patch, filters };
}
describe("status-only job publishing", () => {
  it("rejects an incomplete draft before writing", async () => {
    const { db, patch } = database({ ...valid, profession_id: null });
    await expect(transitionJobStatus(db as never, "tenant-a", "actor-a", "job-a", "open")).rejects.toMatchObject({ fieldErrors: { professionId: expect.any(String) } });
    expect(patch).not.toHaveBeenCalled();
  });
  it("publishes without reassigning the workflow or changing job fields", async () => {
    const { db, patch, filters } = database(valid);
    await publishExistingJob(db as never, "tenant-a", "actor-a", "job-a");
    expect(patch).toHaveBeenCalledOnce();
    expect(patch.mock.calls[0][0]).toMatchObject({ status: "open" });
    expect(patch.mock.calls[0][0]).not.toHaveProperty("workflow_id");
    expect(filters.filter(([key]) => key === "tenant_id").every(([, value]) => value === "tenant-a")).toBe(true);
  });
  it("retains the original posted date on closing", async () => {
    const { db, patch } = database({ ...valid, status: "open", published_at: "2026-11-20T12:00:00Z" });
    await transitionJobStatus(db as never, "tenant-a", "actor-a", "job-a", "closed");
    expect(patch.mock.calls[0][0]).not.toHaveProperty("published_at");
  });
});
