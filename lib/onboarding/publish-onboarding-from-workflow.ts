import "server-only";

import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import {
  saveOnboardingBuilderDraft,
} from "@/lib/onboarding/load-onboarding-builder-meta";
import { persistTenantOnboardingConfig } from "@/lib/onboarding/persist-tenant-onboarding-config";
import { preparePublishedStepDrafts } from "@/lib/onboarding/prepare-published-step-drafts";
import { invalidateTenantCache } from "@/lib/cache";

export { PUBLISH_SUCCESS_MESSAGE } from "@/lib/onboarding/prepare-published-step-drafts";

export async function publishOnboardingFromWorkflow(
  supabase: OnboardingDbClient,
  tenantId: string,
  builderDraft: SerializableWorkflowState,
  updatedBy: string,
  flowName?: string
): Promise<TenantOnboardingConfig | null> {
  if (!isSerializableWorkflowState(builderDraft)) {
    throw new Error("Invalid builder draft");
  }

  const existingConfig = await loadTenantOnboardingConfig(supabase, tenantId, {
    workerFacing: false,
  });

  const { normalizedDraft, steps: stepsToPersist } = preparePublishedStepDrafts(
    builderDraft,
    existingConfig
  );

  console.info("[publishOnboardingFromWorkflow] persisting workflow", {
    tenantId,
    publishStatus: "published",
    stepCount: stepsToPersist.filter((s) => s.is_enabled !== false).length,
    steps: stepsToPersist
      .filter((s) => s.is_enabled !== false)
      .map((s) => ({
        step_key: s.step_key,
        step_type: s.step_type,
        workflow_step_id: s.metadata?.workflow_step_id,
        sort_order: s.sort_order,
      })),
  });

  // Applicant-facing steps first — if this fails, builder draft stays unchanged.
  await persistTenantOnboardingConfig(supabase, tenantId, stepsToPersist, {
    configId: existingConfig?.configId,
  });

  await saveOnboardingBuilderDraft(supabase, tenantId, {
    flowName,
    builderDraft: normalizedDraft,
    updatedBy,
    publishStatus: "published",
  });

  await Promise.all([
    invalidateTenantCache("tenant_onboarding_configs", tenantId),
    invalidateTenantCache("tenant_onboarding_steps", tenantId),
    invalidateTenantCache("tenant_required_documents", tenantId),
    invalidateTenantCache("tenant_skill_assessments", tenantId),
    invalidateTenantCache("tenant_skill_assessment_questions", tenantId),
  ]);

  return loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
}
