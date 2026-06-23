import "server-only";

import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import { configToDrafts } from "@/lib/onboarding/config-to-drafts";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import {
  saveOnboardingBuilderDraft,
} from "@/lib/onboarding/load-onboarding-builder-meta";
import { persistTenantOnboardingConfig } from "@/lib/onboarding/persist-tenant-onboarding-config";

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
  const existingDrafts = existingConfig ? configToDrafts(existingConfig) : [];
  const stepsToPersist = workflowStateToStepDrafts(builderDraft, existingDrafts);

  if (!stepsToPersist.length) {
    throw new Error("Cannot publish an empty workflow. Add at least one step.");
  }

  console.info("[publishOnboardingFromWorkflow] persisting workflow", {
    tenantId,
    publishStatus: "published",
    stepCount: stepsToPersist.length,
    steps: stepsToPersist.map((s) => ({
      step_key: s.step_key,
      step_type: s.step_type,
      workflow_step_id: s.metadata?.workflow_step_id,
      sort_order: s.sort_order,
    })),
  });

  await saveOnboardingBuilderDraft(supabase, tenantId, {
    flowName,
    builderDraft,
    updatedBy,
    publishStatus: "published",
  });

  if (stepsToPersist.length) {
    await persistTenantOnboardingConfig(supabase, tenantId, stepsToPersist, {
      configId: existingConfig?.configId,
    });
  }

  return loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false });
}
