import { describe, expect, it, vi } from "vitest";
import { saveJobRequisition } from "./service";
import { JobValidationError, jobValidationHttpStatus } from "./types";
vi.mock("@/lib/jobs/resolve-profession", () => ({ resolveProfessionIdForSave: async () => "profession-a" }));

describe("job edit revision protection", () => {
  it("rejects a stale tab before mutating the job or its workflow", async () => {
    const update = vi.fn();
    const filters: Array<[string, unknown]> = [];
    const query = { select: () => query, eq: (key: string, value: unknown) => { filters.push([key, value]); return query; }, maybeSingle: async () => ({ data: { updated_at: "2026-11-25T12:00:00Z", status: "draft" }, error: null }), update };
    const db = { from: vi.fn(() => query) };
    const pending = saveJobRequisition(db as never, "tenant-a", "staff-a", { sourceType: "Internal", professionId: "profession-a", employmentType: "W2" }, { jobId: "job-a", publish: false, expectedUpdatedAt: "2026-11-25T11:00:00Z" });
    await expect(pending).rejects.toMatchObject({ code: "JOB_CONFLICT" });
    expect(update).not.toHaveBeenCalled();
    expect(filters).toContainEqual(["tenant_id", "tenant-a"]);
    expect(jobValidationHttpStatus(new JobValidationError("Conflict", {}, "JOB_CONFLICT"))).toBe(409);
  });
});
