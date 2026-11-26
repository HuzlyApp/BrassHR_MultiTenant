import { beforeEach, describe, expect, it, vi } from "vitest";
const helpers = vi.hoisted(() => ({ recruiters: vi.fn(), requirements: vi.fn() }));
vi.mock("@/lib/account/resolve-staff-users", () => ({ loadStaffUsersByIds: helpers.recruiters }));
vi.mock("@/lib/jobs/match-analysis/load-requirement-outcome-counts", () => ({
  loadRequirementOutcomeCountsByApplication: helpers.requirements,
  listingCountsForAnalyzedApplication: () => null,
}));
import { loadStaffApplicationPage } from "./load-staff-application-page";

beforeEach(() => {
  helpers.recruiters.mockReset().mockResolvedValue(new Map([["recruiter-a", { id: "recruiter-a", name: "Recruiter" }]]));
  helpers.requirements.mockReset().mockResolvedValue(new Map());
});
describe("applicant page enrichment performance", () => {
  it("loads independent enrichment together and retains notes, counts and tenant scope", async () => {
    let releaseHistory!: (value: unknown) => void;
    let historyStarted!: () => void;
    const started = new Promise<void>((resolve) => { historyStarted = resolve; });
    const history = new Promise((resolve) => { releaseHistory = resolve; });
    const filters: unknown[][] = [];
    const client = {
      rpc: vi.fn(async () => ({ data: { ids: [{ id: "app-a" }], total: 1, analyzedCount: 0 }, error: null })),
      from: (table: string) => {
        let columns = "";
        const query = {
          select: (value: string) => { columns = value; return query; },
          eq: (...args: unknown[]) => { filters.push([table, ...args]); return query; },
          in: () => query, not: () => query, order: () => query,
          then: (resolve: (value: unknown) => unknown) => {
            if (table === "application_status_history") { historyStarted(); return history.then(resolve); }
            return Promise.resolve({ error: null, data: columns === "worker_id"
              ? [{ worker_id: "worker-a" }, { worker_id: "worker-a" }]
              : [{ id: "app-a", worker_id: "worker-a", assigned_recruiter_user_id: "recruiter-a", application_statuses: { name: "Intake" } }] }).then(resolve);
          },
        };
        return query;
      },
    };
    const result = loadStaffApplicationPage(client as never, "tenant-a", new URLSearchParams());
    await started;
    const recruitersStarted = helpers.recruiters.mock.calls.length;
    const requirementsStarted = helpers.requirements.mock.calls.length;
    releaseHistory({ error: null, data: [{ application_id: "app-a", note: "Newest note" }, { application_id: "app-a", note: "Old note" }] });
    expect(await result).toMatchObject({ total: 1, applications: [{ id: "app-a", statusName: "Intake", statusNote: "Newest note", appliedJobCount: 2, assignedRecruiter: { name: "Recruiter" } }] });
    expect(recruitersStarted).toBe(1);
    expect(requirementsStarted).toBe(1);
    expect(helpers.recruiters).toHaveBeenCalledWith(client, "tenant-a", ["recruiter-a"]);
    expect(helpers.requirements).toHaveBeenCalledWith(client, "tenant-a", ["app-a"]);
    expect(filters).toContainEqual(["job_applications", "tenant_id", "tenant-a"]);
    expect(filters).toContainEqual(["application_status_history", "tenant_id", "tenant-a"]);
  });
});
