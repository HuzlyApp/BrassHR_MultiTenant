import type {
  SkillAssessmentCatalog,
  SkillAssessmentScoring,
  SkillCategoryDraft,
  SkillQuestionDraft,
  SkillQuestionOption,
  SkillQuestionType,
} from "@/lib/skill-assessment/types";
import {
  DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS,
  DEFAULT_SKILL_ASSESSMENT_SCORING,
  SKILL_QUESTION_TYPES,
} from "@/lib/skill-assessment/types";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";

const QUESTION_TYPE_SET = new Set<string>(SKILL_QUESTION_TYPES);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asQuestionType(value: unknown): SkillQuestionType {
  const type = asString(value, "rating");
  return QUESTION_TYPE_SET.has(type) ? (type as SkillQuestionType) : "rating";
}

export function slugifySkillCategoryName(name: string, fallback = "category"): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = slugifySkillCategoryName(base);
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let i = 2;
  while (used.has(`${slug}-${i}`)) i += 1;
  const next = `${slug}-${i}`;
  used.add(next);
  return next;
}

function normalizeOption(raw: unknown, index: number): SkillQuestionOption {
  const row = asRecord(raw) ?? {};
  const id = asString(row.id).trim() || crypto.randomUUID();
  const pointsRaw = row.points;
  return {
    id,
    label: asString(row.label, `Option ${index + 1}`).trim() || `Option ${index + 1}`,
    isCorrect: asBoolean(row.isCorrect, false),
    points: pointsRaw == null || pointsRaw === "" ? null : asNumber(pointsRaw, 0),
  };
}

function defaultOptionsForType(type: SkillQuestionType): SkillQuestionOption[] {
  if (type === "yes_no") {
    return [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ];
  }
  if (type === "true_false") {
    return [
      { id: "true", label: "True" },
      { id: "false", label: "False" },
    ];
  }
  return [];
}

function normalizeCorrectAnswer(
  type: SkillQuestionType,
  raw: unknown,
  options: SkillQuestionOption[]
): string | string[] | null {
  if (type === "rating") return null;
  if (type === "multiple_select") {
    const ids = Array.isArray(raw)
      ? raw.map((v) => asString(v).trim()).filter(Boolean)
      : options.filter((o) => o.isCorrect).map((o) => o.id);
    return ids;
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const marked = options.find((o) => o.isCorrect);
  return marked?.id ?? null;
}

function normalizeQuestion(raw: unknown, index: number): SkillQuestionDraft {
  const row = asRecord(raw) ?? {};
  const type = asQuestionType(row.type ?? row.question_type);
  const rawOptions = Array.isArray(row.options) ? row.options : [];
  const options =
    rawOptions.length > 0
      ? rawOptions.map((option, optionIndex) => normalizeOption(option, optionIndex))
      : defaultOptionsForType(type);
  return {
    id: asString(row.id).trim() || crypto.randomUUID(),
    text: asString(row.text ?? row.question_text ?? row.question).trim() || `Question ${index + 1}`,
    description: asNullableString(row.description),
    type,
    required: asBoolean(row.required ?? row.is_required, true),
    sortOrder: asNumber(row.sortOrder ?? row.sort_order ?? row.quiz_number, index + 1),
    points: Math.max(0, asNumber(row.points, 1)),
    options,
    correctAnswer: normalizeCorrectAnswer(type, row.correctAnswer ?? row.correct_answer, options),
  };
}

function normalizeCategory(raw: unknown, index: number, usedSlugs: Set<string>): SkillCategoryDraft {
  const row = asRecord(raw) ?? {};
  const name = asString(row.name ?? row.title).trim() || `Category ${index + 1}`;
  const questionsRaw = Array.isArray(row.questions) ? row.questions : [];
  return {
    id: asString(row.id).trim() || crypto.randomUUID(),
    name,
    description: asNullableString(row.description),
    instructions: asNullableString(row.instructions),
    slug: uniqueSlug(asString(row.slug) || name, usedSlugs),
    sortOrder: asNumber(row.sortOrder ?? row.sort_order ?? row.order_number, index + 1),
    isActive: asBoolean(row.isActive ?? row.is_enabled ?? row.is_active, true),
    questions: questionsRaw
      .map((question, questionIndex) => normalizeQuestion(question, questionIndex))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((question, questionIndex) => ({ ...question, sortOrder: questionIndex + 1 })),
  };
}

function normalizeScoring(raw: unknown): SkillAssessmentScoring {
  const row = asRecord(raw) ?? {};
  return {
    pointsPerQuestion: Math.max(0, asNumber(row.pointsPerQuestion, DEFAULT_SKILL_ASSESSMENT_SCORING.pointsPerQuestion)),
    passingScore: Math.min(100, Math.max(0, asNumber(row.passingScore, DEFAULT_SKILL_ASSESSMENT_SCORING.passingScore))),
    scoreByCategory: asBoolean(row.scoreByCategory, DEFAULT_SKILL_ASSESSMENT_SCORING.scoreByCategory),
    showOverallScore: asBoolean(row.showOverallScore, DEFAULT_SKILL_ASSESSMENT_SCORING.showOverallScore),
    showResultsToApplicant: asBoolean(
      row.showResultsToApplicant,
      DEFAULT_SKILL_ASSESSMENT_SCORING.showResultsToApplicant
    ),
  };
}

export function normalizeSkillAssessmentCatalog(raw: unknown): SkillAssessmentCatalog {
  const row = asRecord(raw);
  const fallback = createDefaultSkillAssessmentCatalog();
  if (!row) return fallback;
  const usedSlugs = new Set<string>();
  const categoriesRaw = Array.isArray(row.categories) ? row.categories : fallback.categories;
  return {
    enabled: asBoolean(row.enabled, DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS.enabled),
    allowSkip: asBoolean(row.allowSkip, DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS.allowSkip),
    scoring: normalizeScoring(row.scoring),
    categories: categoriesRaw
      .map((category, index) => normalizeCategory(category, index, usedSlugs))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category, index) => ({ ...category, sortOrder: index + 1 })),
  };
}

export function cloneSkillAssessmentCatalog(catalog: SkillAssessmentCatalog): SkillAssessmentCatalog {
  return normalizeSkillAssessmentCatalog(JSON.parse(JSON.stringify(catalog)) as unknown);
}

export function activeSkillCategories(catalog: SkillAssessmentCatalog): SkillCategoryDraft[] {
  return catalog.categories.filter((category) => category.isActive);
}

export function findSkillCategoryBySlug(
  catalog: SkillAssessmentCatalog,
  slug: string
): SkillCategoryDraft | null {
  const needle = slug.trim().toLowerCase();
  return activeSkillCategories(catalog).find((category) => category.slug === needle) ?? null;
}

export function stripSkillAssessmentCorrectAnswers(
  catalog: SkillAssessmentCatalog
): SkillAssessmentCatalog {
  const cloned = cloneSkillAssessmentCatalog(catalog);
  for (const category of cloned.categories) {
    for (const question of category.questions) {
      question.correctAnswer = null;
      question.options = question.options.map((option) => ({
        ...option,
        isCorrect: false,
      }));
    }
  }
  return cloned;
}

export function catalogsAreEqual(a: SkillAssessmentCatalog, b: SkillAssessmentCatalog): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function createEmptySkillCategory(sortOrder: number): SkillCategoryDraft {
  return {
    id: crypto.randomUUID(),
    name: "New category",
    description: "",
    instructions: null,
    slug: uniqueSlug(`category-${sortOrder}`, new Set()),
    sortOrder,
    isActive: true,
    questions: [],
  };
}

export function createEmptySkillQuestion(sortOrder: number): SkillQuestionDraft {
  return {
    id: crypto.randomUUID(),
    text: "New question",
    description: null,
    type: "rating",
    required: true,
    sortOrder,
    points: 1,
    options: [],
    correctAnswer: null,
  };
}

export function duplicateSkillQuestion(question: SkillQuestionDraft, sortOrder: number): SkillQuestionDraft {
  const optionIdMap = new Map<string, string>();
  const options = question.options.map((option) => {
    const nextId = crypto.randomUUID();
    optionIdMap.set(option.id, nextId);
    return { ...option, id: nextId };
  });
  let correctAnswer: SkillQuestionDraft["correctAnswer"] = question.correctAnswer;
  if (typeof correctAnswer === "string" && optionIdMap.has(correctAnswer)) {
    correctAnswer = optionIdMap.get(correctAnswer) ?? correctAnswer;
  } else if (Array.isArray(correctAnswer)) {
    correctAnswer = correctAnswer.map((id) => optionIdMap.get(id) ?? id);
  }
  return {
    ...question,
    id: crypto.randomUUID(),
    text: `${question.text} (copy)`,
    sortOrder,
    options,
    correctAnswer,
  };
}

export function reorderItems<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
