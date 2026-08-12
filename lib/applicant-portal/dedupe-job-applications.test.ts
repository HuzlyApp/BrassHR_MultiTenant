import { describe, expect, it } from "vitest";
import { dedupeJobApplicationsByJob } from "./dedupe-job-applications";

describe("dedupeJobApplicationsByJob", () => {
  it("keeps submitted application over in-progress duplicate for same job", () => {
    const result = dedupeJobApplicationsByJob([
      {
        applicationId: "draft",
        tenantId: "t1",
        jobId: "job1",
        submittedAt: null,
        appliedAt: "2026-08-12T08:00:00.000Z",
      },
      {
        applicationId: "submitted",
        tenantId: "t1",
        jobId: "job1",
        submittedAt: "2026-08-12T09:00:00.000Z",
        appliedAt: "2026-08-12T09:00:00.000Z",
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.applicationId).toBe("submitted");
  });

  it("keeps distinct jobs", () => {
    const result = dedupeJobApplicationsByJob([
      {
        applicationId: "a1",
        tenantId: "t1",
        jobId: "job1",
        submittedAt: "2026-08-12T09:00:00.000Z",
        appliedAt: "2026-08-12T09:00:00.000Z",
      },
      {
        applicationId: "a2",
        tenantId: "t1",
        jobId: "job2",
        submittedAt: null,
        appliedAt: "2026-08-12T10:00:00.000Z",
      },
    ]);

    expect(result).toHaveLength(2);
  });
});
