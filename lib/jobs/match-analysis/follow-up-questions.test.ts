import { describe, expect, it } from "vitest";
import {
  FOLLOW_UP_SYSTEM_PROMPT,
  buildFollowUpQuestionsPrompt,
  checklistFollowUpRows,
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
  it("parses follow_up as its own analysis mode", () => {
    expect(parseAnalysisMode("follow_up")).toBe("follow_up");
    expect(parseAnalysisMode("deep")).toBe("deep");
    expect(parseAnalysisMode("analyze")).toBe("analyze");
    expect(systemPromptForMode("follow_up")).toBe(FOLLOW_UP_SYSTEM_PROMPT);
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
