import {
  reindexStepSortOrders,
  type OnboardingStepDraft,
} from "@/lib/onboarding/default-onboarding-steps";
import { createStepDraftForType } from "@/lib/onboarding/create-step-draft";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export const UPLOAD_RESUME_STEP_KEY = "resume_upload";
export const UPLOAD_RESUME_WORKFLOW_STEP_ID = "resume-basic-profile";
export const UPLOAD_RESUME_TITLE = "Upload Resume";

export function isUploadResumeWorkflowStepId(stepId: string): boolean {
  return stepId === UPLOAD_RESUME_WORKFLOW_STEP_ID;
}

export function isUploadResumeStep(step: {
  step_type: string;
  step_key?: string;
  metadata?: Record<string, unknown>;
}): boolean {
  if (step.step_type === "resume_upload") return true;
  if (step.step_key === UPLOAD_RESUME_STEP_KEY) return true;
  const workflowStepId = step.metadata?.workflow_step_id;
  return typeof workflowStepId === "string" && workflowStepId === UPLOAD_RESUME_WORKFLOW_STEP_ID;
}

export function createUploadResumeStepDraft(
  existingSteps: OnboardingStepDraft[] = []
): OnboardingStepDraft {
  const existing = existingSteps.find((s) => isUploadResumeStep(s) && s.is_enabled !== false);
  if (existing) {
    return {
      ...existing,
      step_key: UPLOAD_RESUME_STEP_KEY,
      step_type: "resume_upload",
      title: existing.title?.trim() || UPLOAD_RESUME_TITLE,
      description:
        existing.description?.trim() || "Upload your resume and confirm your contact information.",
      is_required: true,
      is_enabled: true,
      metadata: {
        ...existing.metadata,
        workflow_step_id: UPLOAD_RESUME_WORKFLOW_STEP_ID,
        parsing_enabled: existing.metadata?.parsing_enabled !== false,
        required: true,
        locked_first_step: true,
      },
    };
  }

  const base = createStepDraftForType("resume_upload", existingSteps);
  return {
    ...base,
    step_key: UPLOAD_RESUME_STEP_KEY,
    title: UPLOAD_RESUME_TITLE,
    description: "Upload your resume and confirm your contact information.",
    is_required: true,
    is_enabled: true,
    metadata: {
      ...base.metadata,
      workflow_step_id: UPLOAD_RESUME_WORKFLOW_STEP_ID,
      parsing_enabled: true,
      required: true,
      locked_first_step: true,
    },
  };
}

function resumeStepNeedsNormalization(steps: OnboardingStepDraft[]): boolean {
  const enabled = steps.filter((s) => s.is_enabled).sort((a, b) => a.sort_order - b.sort_order);
  if (!enabled.length) return true;

  const resumeSteps = enabled.filter(isUploadResumeStep);
  if (!resumeSteps.length) return true;
  if (!isUploadResumeStep(enabled[0])) return true;
  if (resumeSteps.length > 1) return true;

  const resume = resumeSteps[0];
  return !resume.is_required || resume.step_key !== UPLOAD_RESUME_STEP_KEY;
}

/**
 * Ensures exactly one enabled Upload Resume step exists and is always first.
 * Duplicate resume steps are removed (disabled) from the returned list.
 */
export function enforceUploadResumeFirstInDrafts(steps: OnboardingStepDraft[]): {
  steps: OnboardingStepDraft[];
  changed: boolean;
} {
  if (!steps.length) {
    return {
      steps: reindexStepSortOrders([createUploadResumeStepDraft()]),
      changed: true,
    };
  }

  const changed = resumeStepNeedsNormalization(steps);
  const resumeDraft = createUploadResumeStepDraft(steps);

  const withoutResume = steps
    .filter((s) => !isUploadResumeStep(s))
    .map((s) => ({ ...s, is_enabled: s.is_enabled }));

  const disabledResumeDuplicates = steps
    .filter((s) => isUploadResumeStep(s))
    .slice(1)
    .map((s) => ({
      ...s,
      is_enabled: false,
      is_required: false,
      metadata: { ...s.metadata, superseded_by: UPLOAD_RESUME_STEP_KEY },
    }));

  const merged = reindexStepSortOrders([
    resumeDraft,
    ...withoutResume.filter((s) => s.is_enabled !== false),
    ...withoutResume.filter((s) => s.is_enabled === false),
    ...disabledResumeDuplicates,
  ]);

  return { steps: merged, changed };
}

export function enforceUploadResumeFirstInTenantSteps(
  steps: TenantOnboardingStep[]
): { steps: TenantOnboardingStep[]; changed: boolean } {
  const drafts: OnboardingStepDraft[] = steps
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((step) => ({
      step_key: step.step_key,
      title: step.title,
      description: step.description ?? "",
      step_type: step.step_type,
      sort_order: step.sort_order,
      is_required: step.is_required,
      is_enabled: step.is_enabled,
      metadata: step.metadata ?? {},
      required_documents: [],
    }));

  const { steps: normalized, changed } = enforceUploadResumeFirstInDrafts(drafts);

  const byKey = new Map(steps.map((s) => [s.step_key, s]));
  const nextSteps: TenantOnboardingStep[] = normalized.map((draft) => {
    const existing = byKey.get(draft.step_key);
    return {
      id: existing?.id ?? `normalized-${draft.step_key}`,
      step_key: draft.step_key,
      title: draft.title,
      description: draft.description || null,
      step_type: draft.step_type,
      sort_order: draft.sort_order,
      is_required: draft.is_required,
      is_enabled: draft.is_enabled,
      metadata: draft.metadata,
    };
  });

  return { steps: nextSteps, changed };
}
