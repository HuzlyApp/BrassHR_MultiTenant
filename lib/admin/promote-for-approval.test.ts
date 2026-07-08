import { describe, expect, it } from "vitest";
import {
  areFinalApprovalPrerequisitesMet,
  shouldPromoteToForApproval,
} from "@/lib/admin/promote-for-approval";
import { formatPipelineStatusLabel, canPromoteToForApproval } from "@/lib/workers/candidate-status-label";
import { shouldExcludeFromCandidateLists } from "@/lib/workers/candidate-conversion-filter";

describe("for_approval promotion", () => {
  it("promotes only early statuses when prerequisites and final approval are ready", () => {
    expect(
      shouldPromoteToForApproval({
        workerId: "w1",
        currentStatus: "new",
        prerequisitesComplete: true,
        finalApprovalReady: true,
      })
    ).toBe(true);
    expect(
      shouldPromoteToForApproval({
        workerId: "w1",
        currentStatus: "under_review",
        prerequisitesComplete: true,
        finalApprovalReady: true,
      })
    ).toBe(true);
    expect(
      shouldPromoteToForApproval({
        workerId: "w1",
        currentStatus: "approved",
        prerequisitesComplete: true,
        finalApprovalReady: true,
      })
    ).toBe(false);
    expect(
      shouldPromoteToForApproval({
        workerId: "w1",
        currentStatus: "for_approval",
        prerequisitesComplete: true,
        finalApprovalReady: true,
      })
    ).toBe(false);
    expect(
      shouldPromoteToForApproval({
        workerId: "w1",
        currentStatus: "new",
        prerequisitesComplete: false,
        finalApprovalReady: true,
      })
    ).toBe(false);
  });

  it("requires screening, assessments, interview, and references", () => {
    expect(
      areFinalApprovalPrerequisitesMet({
        hasWorker: true,
        sections: [
          {
            id: "screening",
            rows: [
              { id: "call_1", state: "complete", checked: true },
              { id: "call_2", state: "complete", checked: true },
            ],
          },
        ],
        skillAssessments: { completed: 2, total: 2 },
        referencesCount: 1,
      })
    ).toBe(true);

    expect(
      areFinalApprovalPrerequisitesMet({
        hasWorker: true,
        sections: [
          {
            id: "screening",
            rows: [
              { id: "call_1", state: "complete", checked: true },
              { id: "call_2", state: "pending" },
            ],
          },
        ],
        skillAssessments: { completed: 2, total: 2 },
        referencesCount: 1,
      })
    ).toBe(false);
  });
});

describe("candidate status labels", () => {
  it("maps for_approval to For Approval", () => {
    expect(formatPipelineStatusLabel("for_approval")).toBe("For Approval");
    expect(formatPipelineStatusLabel("under_review")).toBe("Pending Review");
    expect(formatPipelineStatusLabel("disapproved")).toBe("Rejected");
  });

  it("allows promotion only from early pipeline statuses", () => {
    expect(canPromoteToForApproval("new")).toBe(true);
    expect(canPromoteToForApproval("pending")).toBe(true);
    expect(canPromoteToForApproval("for_approval")).toBe(false);
    expect(canPromoteToForApproval("approved")).toBe(false);
  });
});

describe("candidate list exclusions", () => {
  it("excludes converted workers from candidate lists", () => {
    expect(shouldExcludeFromCandidateLists("converted", false)).toBe(true);
    expect(shouldExcludeFromCandidateLists("approved", true)).toBe(true);
    expect(shouldExcludeFromCandidateLists("for_approval", false)).toBe(false);
    expect(shouldExcludeFromCandidateLists("approved", false)).toBe(false);
  });
});
