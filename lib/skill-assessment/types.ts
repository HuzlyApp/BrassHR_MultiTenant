export const SKILL_QUESTION_TYPES = [
  "multiple_choice",
  "multiple_select",
  "yes_no",
  "true_false",
  "rating",
] as const;

export type SkillQuestionType = (typeof SKILL_QUESTION_TYPES)[number];

export type SkillQuestionOption = {
  id: string;
  label: string;
  isCorrect?: boolean;
  points?: number | null;
};

export type SkillQuestionDraft = {
  id: string;
  text: string;
  description: string | null;
  type: SkillQuestionType;
  required: boolean;
  sortOrder: number;
  points: number;
  options: SkillQuestionOption[];
  /** Option id, option ids, "yes"/"no", or "true"/"false". Rating questions have no correct answer. */
  correctAnswer: string | string[] | null;
};

export type SkillCategoryDraft = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  questions: SkillQuestionDraft[];
};

export type SkillAssessmentScoring = {
  pointsPerQuestion: number;
  passingScore: number;
  scoreByCategory: boolean;
  showOverallScore: boolean;
  showResultsToApplicant: boolean;
};

export type SkillAssessmentCatalog = {
  enabled: boolean;
  allowSkip: boolean;
  scoring: SkillAssessmentScoring;
  categories: SkillCategoryDraft[];
};

export type SkillAssessmentApplicantSettings = {
  enabled: boolean;
  allowSkip: boolean;
  showResultsToApplicant: boolean;
  passingScore: number;
  scoreByCategory: boolean;
  showOverallScore: boolean;
};

export const DEFAULT_SKILL_ASSESSMENT_SCORING: SkillAssessmentScoring = {
  pointsPerQuestion: 1,
  passingScore: 70,
  scoreByCategory: true,
  showOverallScore: true,
  showResultsToApplicant: false,
};

export const DEFAULT_SKILL_ASSESSMENT_CATALOG_FLAGS = {
  enabled: true,
  allowSkip: true,
} as const;

export type SkillQuizAnswerValue = number | string | string[];
export type SkillQuizAnswers = Record<string, SkillQuizAnswerValue>;
