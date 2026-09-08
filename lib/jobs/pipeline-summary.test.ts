import { describe, expect, it } from "vitest";
import {
  jobDetailsStatsFromPipelineSummary,
  tallyJobPipelineSummary,
} from "@/lib/jobs/pipeline-summary";

describe("tallyJobPipelineSummary", () => {
  it("maps FSD buckets and card rollups", () => {
    const summary = tallyJobPipelineSummary(
      [
        { status: "new" },
        { status: "submitted" },
        { status: "reviewing" },
        { status: "shortlisted" },
        { status: "interviewing" },
        { status: "hired" },
        { status: "rejected" },
        {
          status: "reviewing",
          application_statuses: { system_key: "at_msp", name: "At MSP" },
        },
        {
          status: "hired",
          application_statuses: { system_key: "onboarding", name: "Onboarding" },
        },
      ],
      { showSubmission: true }
    );

    expect(summary).toEqual({
      all: 9,
      intake: 2,
      screening: 1,
      interview: 2,
      submission: 1,
      selected: 1,
      onboarding: 1,
      closed: 1,
      show_submission: true,
    });

    const stats = jobDetailsStatsFromPipelineSummary(summary);
    expect(stats.applicationsNew).toBe(2);
    expect(stats.applicationsInProcess).toBe(3);
    expect(stats.applicationsAtMsp).toBe(1);
    expect(stats.applicationsHired).toBe(2);
    expect(stats.showSubmission).toBe(true);
  });

  it("keeps MSP submission at 0 when show_submission is false", () => {
    const summary = tallyJobPipelineSummary(
      [
        {
          status: "reviewing",
          application_statuses: { system_key: "at_msp", name: "At MSP" },
        },
      ],
      { showSubmission: false }
    );
    expect(summary.submission).toBe(0);
    expect(summary.screening).toBe(1);
    expect(summary.show_submission).toBe(false);
  });
});
