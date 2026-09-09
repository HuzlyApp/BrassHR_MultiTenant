import { describe, expect, it } from "vitest";
import {
  aiScreeningQuestionKey,
  countQualificationOutcomes,
  filterQualificationRequirements,
  formatRecruiterDecision,
  groupRequirementOutcomeCountsByApplication,
  isRecruiterDecision,
  matchSavedAiScreeningAnswer,
  normalizeAnalysisScreeningQuestions,
  qualificationDisplayStatus,
  resolveRecommendedScreeningAnswerUpsert,
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
    expect(filterQualificationRequirements(rows, "not_met")).toHaveLength(0);
  });

  it("rolls requirement outcomes into ranking CONF / VERIFY / NOT MET counts", () => {
    const rows = [
      req({
        id: "c1",
        requirement_outcome: "MET",
        status: "CONFIRMED",
        verification_required: false,
      }),
      req({
        id: "c2",
        requirement_outcome: "MET",
        status: "CONFIRMED",
        verification_required: false,
        recruiter_verified: true,
      }),
      req({ id: "v1", requirement_outcome: "VERIFY", verification_required: true }),
      req({ id: "v2", requirement_outcome: "VERIFY", verification_required: true }),
      req({
        id: "n1",
        requirement_outcome: "NOT_MET",
        status: "NOT_FOUND",
        verification_required: false,
      }),
      req({
        id: "b1",
        requirement_outcome: "CONFLICT",
        status: "CONFLICTING",
        verification_required: false,
      }),
      req({
        id: "na",
        requirement_outcome: "NOT_APPLICABLE",
        status: "NOT_APPLICABLE",
        verification_required: false,
      }),
    ];
    expect(countQualificationOutcomes(rows)).toEqual({
      confirmed: 2,
      verify: 2,
      notMet: 1,
      blocking: 1,
      mandatory: 7,
      preferred: 0,
      total: 7,
    });
    expect(groupRequirementOutcomeCountsByApplication([
      { ...rows[0], job_application_id: "app-1" },
      { ...rows[1], job_application_id: "app-1" },
      { ...rows[2], job_application_id: "app-2" },
      { ...rows[3], job_application_id: "app-2" },
    ])).toEqual(
      new Map([
        ["app-1", { confirmed: 2, verify: 0, notMet: 0 }],
        ["app-2", { confirmed: 0, verify: 2, notMet: 0 }],
      ])
    );
  });

  it("scopes AI screening answer keys by question text", () => {
    expect(aiScreeningQuestionKey(1, "Oil & Gas experience?")).toBe(
      aiScreeningQuestionKey(1, "Oil & Gas experience?")
    );
    expect(aiScreeningQuestionKey(1, "Oil & Gas experience?")).not.toBe(
      aiScreeningQuestionKey(1, "Houston availability?")
    );
  });

  it("normalizes string or object screening questions from analysis JSON", () => {
    expect(
      normalizeAnalysisScreeningQuestions([
        "Confirm TX compact license status.",
        { priority: 2, question: " Verify ICU unit type. ", reason: "JD conflict", related_requirement: "ICU" },
      ])
    ).toEqual([
      { priority: 1, question: "Confirm TX compact license status.", reason: "", relatedRequirement: "" },
      { priority: 2, question: "Verify ICU unit type.", reason: "JD conflict", relatedRequirement: "ICU" },
    ]);
  });

  it("matches saved notes by question text when the generated key changed", () => {
    const rows = new Map([
      [
        "2:old wording",
        { question_key: "2:old wording", question_text: "Are you licensed in Wisconsin?", answer_text: "Yes, compact." },
      ],
    ]);
    expect(
      matchSavedAiScreeningAnswer(rows, "1:are you licensed in wisconsin?", "Are you licensed in Wisconsin?")
        ?.answer_text
    ).toBe("Yes, compact.");
  });

  it("resolves screening notes for upsert even when analysis lookup needs question text", () => {
    const questions = normalizeAnalysisScreeningQuestions([
      { priority: 1, question: "Is your CNA certification currently active?", reason: "Verify cert" },
    ]);
    const resolved = resolveRecommendedScreeningAnswerUpsert(
      {
        key: "stale-key",
        question: "Is your CNA certification currently active?",
        answer: " Yes, expires 2027 ",
      },
      questions
    );
    expect(resolved?.question).toBe("Is your CNA certification currently active?");
    expect(resolved?.answer_text).toBe("Yes, expires 2027");
    expect(resolved?.reason).toBe("Verify cert");
    expect(resolved?.key).toBe(
      aiScreeningQuestionKey(1, "Is your CNA certification currently active?")
    );
  });

  it("rejects a screening note that cannot be matched to a question", () => {
    expect(() =>
      resolveRecommendedScreeningAnswerUpsert({ answer: "Candidate said yes" }, [])
    ).toThrow(/resolve which screening question/i);
  });
});
