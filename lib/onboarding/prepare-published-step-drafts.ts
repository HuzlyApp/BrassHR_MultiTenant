import { configToDrafts } from "@/lib/onboarding/config-to-drafts";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { enforceUploadResumeFirstInWorkflowState } from "@/lib/onboarding/normalize-builder-workflow";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";

export const PUBLISH_SUCCESS_MESSAGE =
  "Onboarding flow published successfully. This flow is now active for applicants.";

/** Enabled published steps only — excludes soft-deleted rows from prior publishes. */
export function enabledPublishedStepDrafts(
  config: TenantOnboardingConfig | null | undefined
): OnboardingStepDraft[] {
  if (!config) return [];
  return configToDrafts(config).filter((step) => step.is_enabled !== false);
}

/**
 * Normalizes the builder canvas and converts it to tenant step drafts for publish.
 * Only canvas nodes are included; Add Resume is enforced as the first required step.
 */
export function preparePublishedStepDrafts(
  builderDraft: SerializableWorkflowState,
  existingConfig: TenantOnboardingConfig | null
): { normalizedDraft: SerializableWorkflowState; steps: OnboardingStepDraft[] } {
  if (!isSerializableWorkflowState(builderDraft)) {
    throw new Error("Invalid builder draft");
  }

  const existingDrafts = enabledPublishedStepDrafts(existingConfig);
  const normalizedDraft = enforceUploadResumeFirstInWorkflowState(builderDraft, existingDrafts);
  const steps = workflowStateToStepDrafts(normalizedDraft, existingDrafts);

  if (!steps.filter((s) => s.is_enabled !== false).length) {
    throw new Error("Cannot publish an empty workflow. Add at least one step.");
  }

  return { normalizedDraft, steps };
}
