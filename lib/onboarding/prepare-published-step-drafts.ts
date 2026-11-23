import { configToDrafts } from "@/lib/onboarding/config-to-drafts";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { enforceUploadResumeFirstInWorkflowState } from "@/lib/onboarding/normalize-builder-workflow";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { assertWorkflowPhasesPublishable } from "@/lib/onboarding/validate-workflow-phases";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";

export const PUBLISH_SUCCESS_MESSAGE =
  "Onboarding flow published successfully. This flow is now active for applicants.";

export const EMPTY_WORKFLOW_PUBLISH_ERROR =
  "Cannot publish an empty workflow. Add at least one step.";

/** Enabled published steps only — excludes soft-deleted rows from prior publishes. */
export function enabledPublishedStepDrafts(
  config: TenantOnboardingConfig | null | undefined
): OnboardingStepDraft[] {
  if (!config) return [];
  return configToDrafts(config).filter((step) => step.is_enabled !== false);
}

/** True when the builder canvas has at least one real step node (before resume auto-inject). */
export function builderDraftHasPublishableSteps(
  builderDraft: SerializableWorkflowState | null | undefined
): boolean {
  if (!builderDraft || !isSerializableWorkflowState(builderDraft)) return false;
  return builderDraft.nodes.some((node) => Boolean(node.stepId?.trim()));
}

/**
 * Normalizes the builder canvas and converts it to tenant step drafts for publish.
 * Only canvas nodes are included; Add Resume is enforced as the first required step.
 * A completely blank canvas cannot be published (resume auto-inject must not create a live flow).
 */
export function preparePublishedStepDrafts(
  builderDraft: SerializableWorkflowState,
  existingConfig: TenantOnboardingConfig | null
): { normalizedDraft: SerializableWorkflowState; steps: OnboardingStepDraft[] } {
  if (!isSerializableWorkflowState(builderDraft)) {
    throw new Error("Invalid builder draft");
  }

  if (!builderDraftHasPublishableSteps(builderDraft)) {
    throw new Error(EMPTY_WORKFLOW_PUBLISH_ERROR);
  }

  const existingDrafts = enabledPublishedStepDrafts(existingConfig);
  const normalizedDraft = enforceUploadResumeFirstInWorkflowState(builderDraft, existingDrafts);
  assertWorkflowPhasesPublishable(normalizedDraft);
  const steps = workflowStateToStepDrafts(normalizedDraft, existingDrafts);

  if (!steps.filter((s) => s.is_enabled !== false).length) {
    throw new Error(EMPTY_WORKFLOW_PUBLISH_ERROR);
  }

  return { normalizedDraft, steps };
}
