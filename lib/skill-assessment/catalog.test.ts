import { describe, expect, it } from "vitest";
import {
  catalogsAreEqual,
  cloneSkillAssessmentCatalog,
  createEmptySkillQuestion,
  duplicateSkillQuestion,
  findSkillCategoryBySlug,
  normalizeSkillAssessmentCatalog,
  reorderItems,
  slugifySkillCategoryName,
  stripSkillAssessmentCorrectAnswers,
} from "@/lib/skill-assessment/catalog";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import { applyPublishedSkillAssessmentToConfig } from "@/lib/skill-assessment/apply-to-config";
import { isCategoryComplete, questionEarnedPoints, scoreSkillAssessment } from "@/lib/skill-assessment/score";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

describe("skill assessment catalog", () => {
  it("normalizes default categories and unique slugs", () => {
    const catalog = normalizeSkillAssessmentCatalog(createDefaultSkillAssessmentCatalog());
    expect(catalog.categories).toHaveLength(5);
    expect(catalog.categories.map((c) => c.slug)).toEqual([
      "basic-care",
      "mobility",
      "clinical",
      "monitoring",
      "documentation",
    ]);
    expect(findSkillCategoryBySlug(catalog, "basic-care")?.name).toBe("Basic Patient Care & Hygiene");
  });

  it("slugifies names and de-dupes", () => {
    expect(slugifySkillCategoryName("Basic Patient Care & Hygiene")).toBe("basic-patient-care-hygiene");
    const catalog = normalizeSkillAssessmentCatalog({
      categories: [
        { name: "Safety", slug: "safety" },
        { name: "Safety", slug: "safety" },
      ],
    });
    expect(catalog.categories.map((c) => c.slug)).toEqual(["safety", "safety-2"]);
  });

  it("strips correct answers for applicants", () => {
    const catalog = cloneSkillAssessmentCatalog(createDefaultSkillAssessmentCatalog());
    catalog.categories[0]!.questions[0] = {
      ...createEmptySkillQuestion(1),
      type: "multiple_choice",
      correctAnswer: "opt-a",
      options: [
        { id: "opt-a", label: "A", isCorrect: true },
        { id: "opt-b", label: "B", isCorrect: false },
      ],
    };
    const stripped = stripSkillAssessmentCorrectAnswers(catalog);
    expect(stripped.categories[0]!.questions[0]!.correctAnswer).toBeNull();
    expect(stripped.categories[0]!.questions[0]!.options.every((o) => o.isCorrect === false)).toBe(true);
  });

  it("duplicates questions with new ids", () => {
    const original = createEmptySkillQuestion(1);
    original.options = [{ id: "opt-a", label: "A", isCorrect: true }];
    original.correctAnswer = "opt-a";
    const copy = duplicateSkillQuestion(original, 2);
    expect(copy.id).not.toBe(original.id);
    expect(copy.options[0]!.id).not.toBe("opt-a");
    expect(copy.correctAnswer).toBe(copy.options[0]!.id);
    expect(copy.sortOrder).toBe(2);
  });

  it("reorders items by id", () => {
    const next = reorderItems(
      [
        { id: "a" },
        { id: "b" },
        { id: "c" },
      ],
      "c",
      "a"
    );
    expect(next.map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("detects catalog equality", () => {
    const a = createDefaultSkillAssessmentCatalog();
    const b = cloneSkillAssessmentCatalog(a);
    expect(catalogsAreEqual(a, b)).toBe(true);
    b.enabled = false;
    expect(catalogsAreEqual(a, b)).toBe(false);
  });
});

describe("skill assessment scoring", () => {
  it("scores multiple choice and rating questions", () => {
    const catalog = createDefaultSkillAssessmentCatalog();
    const category = catalog.categories[0]!;
    category.questions = [
      {
        id: "q1",
        text: "ADL",
        description: null,
        type: "rating",
        required: true,
        sortOrder: 1,
        points: 4,
        options: [],
        correctAnswer: null,
      },
      {
        id: "q2",
        text: "Hand hygiene is required",
        description: null,
        type: "true_false",
        required: true,
        sortOrder: 2,
        points: 2,
        options: [
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ],
        correctAnswer: "true",
      },
    ];
    expect(questionEarnedPoints(category.questions[0]!, 4, 1)).toBe(4);
    expect(questionEarnedPoints(category.questions[1]!, "true", 1)).toBe(2);
    const scored = scoreSkillAssessment(catalog, { "basic-care": { q1: 4, q2: "true" } });
    expect(scored.percent).toBeGreaterThan(0);
    expect(isCategoryComplete(category, { q1: 4, q2: "true" })).toBe(true);
  });
});

describe("applyPublishedSkillAssessmentToConfig", () => {
  const baseConfig = (): TenantOnboardingConfig => ({
    configId: "cfg",
    tenantId: "tenant",
    version: 1,
    steps: [
      {
        id: "resume",
        step_key: "resume_upload",
        title: "Resume",
        description: null,
        step_type: "resume_upload",
        sort_order: 10,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
      {
        id: "skill",
        step_key: "skill_assessment",
        title: "Skill Assessment",
        description: null,
        step_type: "skill_assessment",
        sort_order: 30,
        is_required: true,
        is_enabled: true,
        metadata: {},
      },
    ],
    requiredDocuments: [],
    skillAssessments: [{ id: "a", onboarding_step_id: "skill", title: "Quiz", description: null, is_enabled: true, questions: [] }],
    candidateEngineOrder: [
      { id: "resume", step_key: "resume_upload", sort_order: 10, required: true, candidateVisible: true },
      { id: "skill", step_key: "skill_assessment", sort_order: 30, required: true, candidateVisible: true },
    ],
  });

  it("hides skill assessment steps when disabled", () => {
    const result = applyPublishedSkillAssessmentToConfig(baseConfig(), {
      enabled: false,
      allowSkip: true,
      showResultsToApplicant: false,
      passingScore: 70,
      scoreByCategory: true,
      showOverallScore: true,
    });
    expect(result.steps.map((s) => s.step_key)).toEqual(["resume_upload"]);
    expect(result.skillAssessments).toEqual([]);
    expect(result.candidateEngineOrder?.map((s) => s.step_key)).toEqual(["resume_upload"]);
    expect(result.skillAssessmentSettings?.enabled).toBe(false);
  });

  it("keeps the step when enabled", () => {
    const result = applyPublishedSkillAssessmentToConfig(baseConfig(), {
      enabled: true,
      allowSkip: false,
      showResultsToApplicant: true,
      passingScore: 80,
      scoreByCategory: true,
      showOverallScore: true,
    });
    expect(result.steps.some((s) => s.step_type === "skill_assessment")).toBe(true);
    expect(result.skillAssessmentSettings?.allowSkip).toBe(false);
  });
});
