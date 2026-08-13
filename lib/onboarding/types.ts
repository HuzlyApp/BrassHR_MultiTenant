export const ONBOARDING_STEP_TYPES = [
  "resume_upload",
  "document_upload",
  "skill_assessment",
  "profile_information",
  "custom_question",
  "review_submit",
  "professional_license",
  "references",
  "authorizations",
] as const;

export type OnboardingStepType = (typeof ONBOARDING_STEP_TYPES)[number];

export type OnboardingStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "failed";

export type TenantOnboardingStep = {
  id: string;
  step_key: string;
  title: string;
  description: string | null;
  step_type: OnboardingStepType;
  sort_order: number;
  is_required: boolean;
  is_enabled: boolean;
  metadata: Record<string, unknown>;
};

export type TenantRequiredDocument = {
  id: string;
  onboarding_step_id: string;
  title: string;
  description: string | null;
  is_required: boolean;
  sort_order: number;
  accepted_file_types: string[];
  max_file_size_mb: number;
};

export type TenantSkillAssessment = {
  id: string;
  onboarding_step_id: string;
  title: string;
  description: string | null;
  is_enabled: boolean;
  questions: TenantSkillQuestion[];
};

export type TenantSkillQuestion = {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  is_required: boolean;
  sort_order: number;
  points: number;
};

export type TenantOnboardingConfig = {
  configId: string;
  tenantId: string;
  version: number;
  steps: TenantOnboardingStep[];
  requiredDocuments: TenantRequiredDocument[];
  skillAssessments: TenantSkillAssessment[];
};

export type StepProgressRow = {
  onboarding_step_id: string;
  /** Present when progress was loaded from tenant steps; used to match job-workflow step ids. */
  step_key?: string | null;
  status: OnboardingStepStatus;
  completed_at: string | null;
  data: Record<string, unknown>;
};

export type WorkerOnboardingProgressPayload = {
  progressId: string;
  status: string;
  steps: StepProgressRow[];
  /** Highest 1-based step index the applicant has reached in this flow. */
  farthestReachedStepIndex?: number;
  submittedAt?: string | null;
  submittedWithIncompleteSteps?: boolean;
  incompleteStepKeys?: string[];
  applicationStatus?: string | null;
  applicationId?: string | null;
  workflowPhase?: "pre_hire" | "post_hire" | "completed" | null;
};
