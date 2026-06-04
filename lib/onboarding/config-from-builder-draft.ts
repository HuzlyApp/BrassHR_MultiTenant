import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import { configToDrafts } from "@/lib/onboarding/config-to-drafts";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { saveOnboardingBuilderDraft } from "@/lib/onboarding/load-onboarding-builder-meta";
import { stepDraftsToSerializableWorkflow } from "@/lib/onboarding/step-drafts-to-workflow-state";

/**
 * Builds an in-memory tenant config from a workflow canvas draft (not written to DB).
 */
export function configFromWorkflowDraft(
  published: TenantOnboardingConfig | null,
  builderDraft: SerializableWorkflowState
): TenantOnboardingConfig | null {
  if (!published) return null;

  const existingDrafts = configToDrafts(published);
  const stepDrafts = workflowStateToStepDrafts(builderDraft, existingDrafts);

  const steps = stepDrafts
    .filter((s) => s.is_enabled)
    .map((draft, index) => {
      const prior = published.steps.find((s) => s.step_key === draft.step_key);
      return {
        id: prior?.id ?? `preview-${draft.step_key}`,
        step_key: draft.step_key,
        title: draft.title,
        description: draft.description?.trim() || null,
        step_type: draft.step_type,
        sort_order: draft.sort_order ?? (index + 1) * 10,
        is_required: draft.is_required,
        is_enabled: true,
        metadata: draft.metadata ?? {},
      };
    });

  return {
    ...published,
    steps,
    requiredDocuments: published.requiredDocuments,
    skillAssessments: published.skillAssessments,
  };
}

export async function syncBuilderDraftFromStepDrafts(
  supabase: OnboardingDbClient,
  tenantId: string,
  steps: OnboardingStepDraft[],
  updatedBy: string,
  flowName?: string
): Promise<SerializableWorkflowState> {
  const builderDraft = stepDraftsToSerializableWorkflow(steps);
  await saveOnboardingBuilderDraft(supabase, tenantId, {
    flowName,
    builderDraft,
    updatedBy,
    publishStatus: "draft",
  });
  return builderDraft;
}

