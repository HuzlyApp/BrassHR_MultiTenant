import { describe, expect, it } from "vitest";
import { tallyApplicationMetrics, tallyJobListApplicationMetrics } from "@/lib/jobs/job-list-application-metrics";

describe("tallyJobListApplicationMetrics", () => {
  it("counts every application for the job, including rejected and withdrawn", () => {
    const metrics = tallyJobListApplicationMetrics([
      { job_requisition_id: "job-1", status: "rejected" },
      { job_requisition_id: "job-1", status: "withdrawn" },
      { job_requisition_id: "job-1", status: "rejected" },
      { job_requisition_id: "job-1", status: "new" },
      { job_requisition_id: "job-1", status: "new" },
      { job_requisition_id: "job-1", status: "reviewing" },
    ]);

    expect(metrics.get("job-1")?.applicantCount).toBe(6);
  });

  it("counts nested job-card rows that have no job_requisition_id", () => {
    const metrics = tallyApplicationMetrics([
      { status: "rejected" },
      { status: "new" },
      { status: "new" },
      { status: "reviewing" },
    ]);
    expect(metrics.applicantCount).toBe(4);
  });

  it("includes archived, rejected, and withdrawn on All", () => {
    const metrics = tallyApplicationMetrics([
      { status: "rejected" },
      { status: "withdrawn" },
      { status: "new", application_statuses: { system_key: "archived" } },
      { status: "new" },
      { status: "new" },
      { status: "reviewing" },
    ]);
    expect(metrics.applicantCount).toBe(6);
  });

  it("includes rejected applications in analysis metrics", () => {
    const metrics = tallyJobListApplicationMetrics([
      {
        job_requisition_id: "job-1",
        status: "rejected",
        ai_match_status: "ANALYZED",
        ai_match_score: 92,
        ai_match_readiness: "READY_TO_SUBMIT",
      },
      {
        job_requisition_id: "job-1",
        status: "new",
        ai_match_status: "ANALYZED",
        ai_match_score: 45,
      },
    ]);

    expect(metrics.get("job-1")).toMatchObject({
      applicantCount: 2,
      analyzedCount: 2,
      strongCount: 1,
      readyCount: 1,
    });
  });
});
