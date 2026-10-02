import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_ENRICHMENT_SYSTEM_PROMPT,
  FOLLOW_UP_ENRICHMENT_USER_TEMPLATE,
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpNonEmptyRepairPrompt,
  buildFollowUpQuestionsPrompt,
  checklistFollowUpRows,
  ensureFollowUpUserPrompt,
  mergeFollowUpQuestions,
  parseFollowUpQuestions,
} from "./follow-up-questions";
import { systemPromptForMode } from "./prompts";
import { parseAnalysisMode } from "./schema";
import type { QualificationRequirement } from "./workspace";

function req(overrides: Partial<QualificationRequirement>): QualificationRequirement {
  return {
    id: "1",
    requirement_text: "BLS",
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

describe("follow-up screening questions", () => {
  it("parses call_pack as Step 2 Verifications screening-question mode", () => {
    expect(parseAnalysisMode("call_pack")).toBe("call_pack");
    expect(parseAnalysisMode("follow_up")).toBe("follow_up");
    expect(parseAnalysisMode("deep")).toBe("deep");
    expect(parseAnalysisMode("analyze")).toBe("analyze");
    expect(systemPromptForMode("call_pack")).toBe(FOLLOW_UP_SYSTEM_PROMPT);
    expect(systemPromptForMode("follow_up")).toBe(FOLLOW_UP_ENRICHMENT_SYSTEM_PROMPT);
    expect(FOLLOW_UP_ENRICHMENT_SYSTEM_PROMPT).toContain("An empty array is invalid");
    expect(FOLLOW_UP_ENRICHMENT_USER_TEMPLATE).toContain("{{enrichment_notes}}");
    expect(FOLLOW_UP_ENRICHMENT_USER_TEMPLATE).not.toContain("Prefer empty array");
  });

  it("overrides an older Follow-Up prompt that preferred an empty list", () => {
    const legacy =
      "Return 0-5 focused questions. Prefer empty array when nothing remains open.";
    const ensured = ensureFollowUpUserPrompt(legacy, "follow_up");
    expect(ensured).toContain("An empty array is invalid");
    expect(ensured).toContain("start date");
    expect(ensureFollowUpUserPrompt(FOLLOW_UP_ENRICHMENT_USER_TEMPLATE, "follow_up")).toBe(
      FOLLOW_UP_ENRICHMENT_USER_TEMPLATE
    );
    expect(ensureFollowUpUserPrompt(legacy, "call_pack")).toBe(legacy);
    expect(
      buildFollowUpNonEmptyRepairPrompt({
        userPrompt: legacy,
        badJson: '{"screening_questions":[]}',
      })
    ).toContain("screening_questions is empty");
  });

  it("builds the prompt from Qualification Checklist statuses and recruiter notes", () => {
    const checklist = checklistFollowUpRows([
      req({
        requirement_text: "Active RN license",
        recruiter_verified: true,
        recruiter_note: "Verified in Nursys",
      }),
      req({
        id: "2",
        requirement_text: "BLS",
        latest_verification_note: {
          id: "n1",
          noteBody: "Ask for card photo",
          candidateQuestion: "Can you send your BLS card?",
          dueDate: null,
          verificationStatus: "pending",
          candidateResponse: null,
          createdByName: "Recruiter",
          updatedByName: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
        },
      }),
    ]);
    const prompt = buildFollowUpQuestionsPrompt({
      jobTitle: "New test job",
      checklist,
    });
    expect(prompt).toContain("New test job");
    expect(prompt).toContain("[Confirmed]");
    expect(prompt).toContain("Verified in Nursys");
    expect(prompt).toContain("[Needs Verification]");
    expect(prompt).toContain("Ask for card photo");
    expect(prompt).toContain("Can you send your BLS card?");
    expect(prompt).toContain("QUALIFICATION CHECKLIST");
    expect(prompt).toContain("Step 2 Verifications");
  });

  it("parses screening questions and merges them into the existing analysis", () => {
    const parsed = parseFollowUpQuestions(`{
      "screening_questions": [
        {
          "priority": 1,
          "question": "Please send a photo of your current BLS card.",
          "reason": "Recruiter note asks for the card photo.",
          "related_requirement": "BLS"
        }
      ]
    }`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.questions[0]?.relatedRequirement).toBe("BLS");
    const merged = mergeFollowUpQuestions(
      { quick_match: { quick_route: "REVIEW" }, screening_questions: [] },
      parsed.questions
    );
    expect(merged.quick_match).toEqual({ quick_route: "REVIEW" });
    const aliased = parseFollowUpQuestions(`{
      "follow_up_questions": [
        {
          "priority": 1,
          "question": "What date can you start?",
          "reason": "Start date was not collected on the call.",
          "related_requirement": "Start date"
        }
      ]
    }`);
    expect(aliased.ok).toBe(true);
    if (!aliased.ok) return;
    expect(aliased.questions[0]?.question).toBe("What date can you start?");
    expect(merged.screening_questions).toEqual([
      {
        priority: 1,
        question: "Please send a photo of your current BLS card.",
        reason: "Recruiter note asks for the card photo.",
        related_requirement: "BLS",
      },
    ]);
  });
});
