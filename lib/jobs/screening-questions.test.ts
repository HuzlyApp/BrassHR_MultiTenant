import { describe, expect, it } from "vitest";
import {
  buildScreeningAssessment,
  formatScreeningAnswerDisplay,
  isScreeningAnswerEmpty,
  mergeApplicationScreeningViews,
  normalizeJobScreeningQuestionInput,
  normalizeScreeningAnswerValue,
  type ApplicationScreeningAnswerRow,
  type JobScreeningQuestionRow,
} from "./screening-questions";

describe("screening-questions", () => {
  it("normalizes job screening question inputs and ordering", () => {
    const normalized = normalizeJobScreeningQuestionInput(
      {
        question: "  Do you have outpatient experience?  ",
        questionType: "yes_no",
      },
      2
    );
    expect(normalized?.question).toBe("Do you have outpatient experience?");
    expect(normalized?.questionType).toBe("yes_no");
    expect(normalized?.options).toEqual([
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ]);
    expect(normalized?.sortOrder).toBe(2);
  });

  it("formats typed answers for display", () => {
    expect(formatScreeningAnswerDisplay("yes_no", true, null)).toBe("Yes");
    expect(formatScreeningAnswerDisplay("number", 4, null)).toBe("4");
    expect(formatScreeningAnswerDisplay("long_text", "", null)).toBe("Not answered");
    expect(
      formatScreeningAnswerDisplay("single_select", "icu", [
        { label: "ICU", value: "icu" },
      ])
    ).toBe("ICU");
  });

  it("merges questions and answers per application without cross-job leakage", () => {
    const jobAQuestion: JobScreeningQuestionRow = {
      id: "q1",
      tenant_id: "t1",
      job_id: "job-a",
      question: "Outpatient experience?",
      question_type: "yes_no",
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
      is_required: true,
      sort_order: 0,
      is_active: true,
      created_by: null,
      created_at: "",
      updated_at: "",
    };
    const jobBAnswer: ApplicationScreeningAnswerRow = {
      id: "a1",
      tenant_id: "t1",
      application_id: "app-b",
      question_id: "q1",
      question_text: "ICU experience?",
      answer: { value: false },
      created_at: "",
      updated_at: "",
    };

    const jobAViews = mergeApplicationScreeningViews({
      questions: [jobAQuestion],
      answers: [{ ...jobBAnswer, answer: { value: true } }],
    });
    expect(jobAViews[0]?.answerDisplay).toBe("Yes");

    const jobBViews = mergeApplicationScreeningViews({
      questions: [{ ...jobAQuestion, question: "ICU experience?" }],
      answers: [jobBAnswer],
    });
    expect(jobBViews[0]?.answerDisplay).toBe("No");
  });

  it("builds screening assessment summary", () => {
    const assessment = buildScreeningAssessment([
      {
        id: "q1",
        question: "Q1",
        questionType: "yes_no",
        options: null,
        isRequired: true,
        sortOrder: 0,
        isActive: true,
        answer: true,
        answerDisplay: "Yes",
        answered: true,
      },
      {
        id: "q2",
        question: "Q2",
        questionType: "short_text",
        options: null,
        isRequired: false,
        sortOrder: 1,
        isActive: true,
        answer: null,
        answerDisplay: "Not answered",
        answered: false,
      },
    ]);
    expect(assessment.requiredAnswered).toBe(1);
    expect(assessment.requiredTotal).toBe(1);
    expect(assessment.summary).toContain("required screening criteria");
  });

  it("detects empty answers by question type", () => {
    expect(isScreeningAnswerEmpty("short_text", "  ")).toBe(true);
    expect(isScreeningAnswerEmpty("multiple_select", [])).toBe(true);
    expect(normalizeScreeningAnswerValue("yes_no", "yes")).toBe(true);
    expect(normalizeScreeningAnswerValue("number", "4")).toBe(4);
  });
});
