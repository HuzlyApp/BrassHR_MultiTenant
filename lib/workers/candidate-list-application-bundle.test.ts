import { describe, expect, it, vi } from "vitest";
import { loadCandidateListApplicationBundle } from "@/lib/workers/candidate-list-application-bundle";

describe("loadCandidateListApplicationBundle", () => {
  it("derives status, match, jobs, assignees, and counts from one query", async () => {
    const rows = [
      {
        id: "app-1",
        worker_id: "w1",
        status: "screening",
        status_id: "st-1",
        assigned_recruiter_user_id: "r1",
        job_requisition_id: "job-1",
        ai_match_status: "ANALYZED",
        ai_match_score: 88,
        ai_match_category: "strong",
        ai_match_display_category: "Strong",
        ai_match_stage: "analyzed",
        updated_at: "2026-09-20T00:00:00Z",
        created_at: "2026-09-19T00:00:00Z",
        application_statuses: { id: "st-1", name: "Screening", system_key: "screening" },
        job_requisitions: {
          public_title: "RN ICU",
          source_job_title: null,
          source_type: "msp",
          msp_name: "Acme",
          external_requisition_id: "MSP-9",
        },
      },
      {
        id: "app-2",
        worker_id: "w1",
        status: "rejected",
        status_id: "st-2",
        assigned_recruiter_user_id: null,
        job_requisition_id: "job-2",
        ai_match_status: null,
        ai_match_score: null,
        ai_match_category: null,
        ai_match_display_category: null,
        ai_match_stage: null,
        updated_at: "2026-09-18T00:00:00Z",
        created_at: "2026-09-18T00:00:00Z",
        application_statuses: { id: "st-2", name: "Rejected", system_key: "rejected" },
        job_requisitions: {
          public_title: "RN MedSurg",
          source_job_title: null,
          source_type: "direct",
          msp_name: null,
          external_requisition_id: null,
        },
      },
    ];

    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.order = vi.fn(async () => ({ data: rows, error: null }));

    const supabase = {
      from: vi.fn(() => builder),
    };

    const bundle = await loadCandidateListApplicationBundle(supabase as never, {
      tenantId: "tenant-a",
      workerIds: ["w1"],
    });

    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("job_applications");
    expect(bundle.appliedJobCounts.get("w1")).toBe(2);
    expect(bundle.summaries.get("w1")).toMatchObject({
      applicationId: "app-1",
      statusName: "Screening",
      jobTitle: "RN ICU",
      clientName: "Acme",
      sourceJobId: "MSP-9",
      ambiguous: false,
    });
    expect(bundle.matchBundle.summaries.get("w1")).toMatchObject({
      applicationId: "app-1",
      score: 88,
      status: "ANALYZED",
    });
    expect(bundle.appliedJobsByWorker.get("w1")).toEqual([{ jobId: "job-1", title: "RN ICU" }]);
    expect(bundle.jobAssigneesByWorker.get("w1")).toEqual([
      {
        applicationId: "app-1",
        jobTitle: "RN ICU",
        assignedRecruiterUserId: "r1",
      },
    ]);
    expect(bundle.matchBundle.analyzedApplicationIds).toEqual(["app-1"]);
  });

  it("returns empty maps for empty worker ids without querying", async () => {
    const from = vi.fn();
    const bundle = await loadCandidateListApplicationBundle({ from } as never, {
      tenantId: "tenant-a",
      workerIds: [],
    });
    expect(from).not.toHaveBeenCalled();
    expect(bundle.appliedJobCounts.size).toBe(0);
    expect(bundle.summaries.size).toBe(0);
  });
});
