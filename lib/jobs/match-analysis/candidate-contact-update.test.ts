import { describe, expect, it } from "vitest";
import {
  contactEditsFromExtractedText,
  emailChangeTarget,
  planExtractedResumeSave,
} from "./candidate-contact-update";
import { matchWorkspaceIsAnalyzed } from "./match-stage";

const previousText = `Alex Rivera
alex.old@example.com
415-555-0199
San Francisco, CA
Registered Nurse`;

const nextText = `Alex Rivera
alex.new@example.com
415-555-0199
San Francisco, CA
Registered Nurse`;

const analysis = {
  quick_match: { quick_route: "REVIEW" },
  screening_questions: [{ priority: 1, question: "Confirm license", reason: "", related_requirement: "License" }],
  follow_up_questions: [{ priority: 1, question: "Start date?", reason: "", related_requirement: "Availability" }],
};

describe("candidate contact updates", () => {
  it("keeps stage 3 and the saved analysis when the extracted email changes", () => {
    const plan = planExtractedResumeSave({
      previousText,
      nextText,
      workerId: "worker-1",
      stage: "follow_up",
      status: "ANALYZED",
      analysis,
    });
    expect(plan.resetStage).toBe(false);
    expect(plan.stage).toBe("follow_up");
    expect(plan.status).toBe("ANALYZED");
    expect(plan.workerId).toBe("worker-1");
    expect(plan.analysis).toBe(analysis);
    expect(plan.contactPatch.email).toBe("alex.new@example.com");
    expect(plan.contactPatch.phone).toBeUndefined();
    expect(plan.contactPatch.firstName).toBeUndefined();
  });

  it("writes the new email onto the same worker and refuses a conflicting candidate", () => {
    expect(emailChangeTarget({ currentWorkerId: "worker-1", conflictingWorkerId: null })).toEqual({
      action: "update",
      workerId: "worker-1",
    });
    expect(
      emailChangeTarget({ currentWorkerId: "worker-1", conflictingWorkerId: "worker-1" })
    ).toEqual({ action: "update", workerId: "worker-1" });
    expect(
      emailChangeTarget({ currentWorkerId: "worker-1", conflictingWorkerId: "worker-2" })
    ).toEqual({ action: "conflict" });
  });

  it("lets a candidate continue at stage 3 after a contact save marked the status NEEDS_REVIEW", () => {
    expect(
      matchWorkspaceIsAnalyzed({
        status: "NEEDS_REVIEW",
        stage: "follow_up",
        hasAnalysis: true,
      })
    ).toBe(true);
    expect(
      matchWorkspaceIsAnalyzed({
        status: "NEEDS_REVIEW",
        stage: null,
        hasAnalysis: false,
      })
    ).toBe(false);
    expect(matchWorkspaceIsAnalyzed({ status: "ANALYZED", stage: "follow_up", hasAnalysis: true })).toBe(
      true
    );
  });

  it("detects only the contact lines that changed in the résumé text", () => {
    expect(contactEditsFromExtractedText(previousText, previousText)).toEqual({});
    expect(contactEditsFromExtractedText(previousText, nextText).email).toBe("alex.new@example.com");
  });
});
