import { describe, expect, it } from "vitest";
import {
  aiScreeningQuestionKey,
  filterQualificationRequirements,
  formatRecruiterDecision,
  isRecruiterDecision,
  qualificationDisplayStatus,
  type QualificationRequirement,
} from "./workspace";

function req(overrides: Partial<QualificationRequirement>): QualificationRequirement {
  return {
    id: "1",
    requirement_text: "Oil & Gas experience",
    requirement_type: "MANDATORY",
    status: "NOT_FOUND",
    requirement_outcome: "VERIFY",
    candidate_evidence: "",
    verification_required: true,
    confidence: 40,
    recruiter_verified: false,
    recruiter_note: null,
    ...overrides,
  };
}

describe("candidate analysis workspace helpers", () => {
  it("keeps recruiter decisions separate from AI recommendation labels", () => {
    expect(isRecruiterDecision("proceed_to_screening")).toBe(true);
    expect(isRecruiterDecision("CALL_AND_VERIFY")).toBe(false);
    expect(formatRecruiterDecision("do_not_pursue")).toBe("Do Not Pursue for This Job");
  });

  it("maps requirement outcomes to recruiter-facing statuses", () => {
    expect(qualificationDisplayStatus(req({ recruiter_verified: true }))).toBe("Confirmed");
    expect(qualificationDisplayStatus(req({ requirement_outcome: "VERIFY" }))).toBe(
      "Needs Verification"
    );
    expect(qualificationDisplayStatus(req({ requirement_outcome: "NOT_MET", status: "NOT_FOUND", verification_required: false }))).toBe(
      "Not Met"
    );
    expect(qualificationDisplayStatus(req({ requirement_outcome: "CONFLICT", status: "CONFLICTING" }))).toBe(
      "Blocking"
    );
  });

  it("filters mandatory vs preferred without mixing applications", () => {
    const rows = [
      req({ id: "a", requirement_type: "MANDATORY", requirement_text: "Job A mandatory" }),
      req({
        id: "b",
        requirement_type: "PREFERRED",
        requirement_text: "Job A preferred",
        requirement_outcome: "MET",
        status: "CONFIRMED",
        verification_required: false,
      }),
    ];
    expect(filterQualificationRequirements(rows, "mandatory")).toHaveLength(1);
    expect(filterQualificationRequirements(rows, "preferred")[0]?.id).toBe("b");
    expect(filterQualificationRequirements(rows, "needs_verification")[0]?.id).toBe("a");
  });

  it("scopes AI screening answer keys by question text", () => {
    expect(aiScreeningQuestionKey(1, "Oil & Gas experience?")).toBe(
      aiScreeningQuestionKey(1, "Oil & Gas experience?")
    );
    expect(aiScreeningQuestionKey(1, "Oil & Gas experience?")).not.toBe(
      aiScreeningQuestionKey(1, "Houston availability?")
    );
  });
});
