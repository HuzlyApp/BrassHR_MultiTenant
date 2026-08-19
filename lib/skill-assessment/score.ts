import type {
  SkillAssessmentCatalog,
  SkillCategoryDraft,
  SkillQuestionDraft,
  SkillQuizAnswerValue,
  SkillQuizAnswers,
} from "@/lib/skill-assessment/types";
import { activeSkillCategories } from "@/lib/skill-assessment/catalog";

function optionIds(question: SkillQuestionDraft): Set<string> {
  return new Set(question.options.map((option) => option.id));
}

function answerMatches(question: SkillQuestionDraft, answer: SkillQuizAnswerValue | undefined): boolean {
  if (answer == null) return false;
  const correct = question.correctAnswer;
  if (question.type === "multiple_select") {
    const expected = new Set(Array.isArray(correct) ? correct : []);
    const actual = new Set(Array.isArray(answer) ? answer.map(String) : [String(answer)]);
    if (expected.size === 0) return false;
    if (expected.size !== actual.size) return false;
    for (const id of expected) {
      if (!actual.has(id)) return false;
    }
    return true;
  }
  if (typeof correct !== "string" || !correct) return false;
  return String(answer) === correct;
}

export function questionEarnedPoints(
  question: SkillQuestionDraft,
  answer: SkillQuizAnswerValue | undefined,
  defaultPoints: number
): number {
  const maxPoints = question.points || defaultPoints || 0;
  if (answer == null) return 0;

  if (question.type === "rating") {
    const value = typeof answer === "number" ? answer : Number(answer);
    if (!Number.isFinite(value) || value < 1) return 0;
    return Math.min(4, value) * (maxPoints / 4);
  }

  if (question.type === "multiple_choice" || question.type === "yes_no" || question.type === "true_false") {
    const selectedId = Array.isArray(answer) ? answer[0] : String(answer);
    const selected = question.options.find((option) => option.id === selectedId);
    if (selected?.points != null) return selected.points;
    return answerMatches(question, answer) ? maxPoints : 0;
  }

  if (question.type === "multiple_select") {
    if (answerMatches(question, answer)) return maxPoints;
    const selected = Array.isArray(answer) ? answer : [String(answer)];
    let earned = 0;
    for (const id of selected) {
      const option = question.options.find((row) => row.id === id);
      if (option?.points != null) earned += option.points;
    }
    return earned;
  }

  return 0;
}

export function questionMaxPoints(question: SkillQuestionDraft, defaultPoints: number): number {
  if (question.type === "rating") return question.points || defaultPoints || 4;
  return question.points || defaultPoints || 0;
}

export type CategoryScore = {
  categoryId: string;
  slug: string;
  name: string;
  earned: number;
  max: number;
  percent: number;
};

export type AssessmentScore = {
  earned: number;
  max: number;
  percent: number;
  passed: boolean;
  byCategory: CategoryScore[];
};

function percent(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 100);
}

export function scoreSkillCategory(
  category: SkillCategoryDraft,
  answers: SkillQuizAnswers,
  defaultPoints: number
): CategoryScore {
  let earned = 0;
  let max = 0;
  for (const question of category.questions) {
    max += questionMaxPoints(question, defaultPoints);
    earned += questionEarnedPoints(question, answers[question.id], defaultPoints);
  }
  return {
    categoryId: category.id,
    slug: category.slug,
    name: category.name,
    earned,
    max,
    percent: percent(earned, max),
  };
}

export function scoreSkillAssessment(
  catalog: SkillAssessmentCatalog,
  answersByCategory: Record<string, SkillQuizAnswers>
): AssessmentScore {
  const defaultPoints = catalog.scoring.pointsPerQuestion;
  const byCategory = activeSkillCategories(catalog).map((category) =>
    scoreSkillCategory(category, answersByCategory[category.slug] ?? {}, defaultPoints)
  );
  const earned = byCategory.reduce((sum, row) => sum + row.earned, 0);
  const max = byCategory.reduce((sum, row) => sum + row.max, 0);
  const overall = percent(earned, max);
  return {
    earned,
    max,
    percent: overall,
    passed: overall >= catalog.scoring.passingScore,
    byCategory,
  };
}

export function isQuestionAnswered(question: SkillQuestionDraft, answer: SkillQuizAnswerValue | undefined): boolean {
  if (answer == null) return false;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "number") return Number.isFinite(answer) && answer > 0;
  return String(answer).trim().length > 0;
}

export function isCategoryComplete(category: SkillCategoryDraft, answers: SkillQuizAnswers): boolean {
  const required = category.questions.filter((question) => question.required);
  const toCheck = required.length ? required : category.questions;
  return toCheck.length > 0 && toCheck.every((question) => isQuestionAnswered(question, answers[question.id]));
}

export function isValidRatingAnswer(value: unknown): value is number {
  return typeof value === "number" && value >= 1 && value <= 4;
}

export function optionSetForQuestion(question: SkillQuestionDraft): Set<string> {
  return optionIds(question);
}
