import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { loadOnboardingBuilderMeta } from "@/lib/onboarding/load-onboarding-builder-meta";
import { configFromWorkflowDraft } from "@/lib/onboarding/config-from-builder-draft";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

/** Applicant-facing config from the saved builder canvas (unpublished draft). */
export async function loadApplicantDraftOnboardingConfig(
  supabase: OnboardingDbClient,
  tenantId: string
): Promise<TenantOnboardingConfig | null> {
  const published = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false });
  if (!published) return null;

  const builder = await loadOnboardingBuilderMeta(supabase, tenantId);
  if (!builder.builderDraft?.nodes?.length) return null;

  const draftConfig = configFromWorkflowDraft(published, builder.builderDraft);
  if (!draftConfig) return null;

  return applyApplicantConfigFilters(draftConfig);
}

export function isPreviewOnboardingStepId(stepId: string | null | undefined): boolean {
  return (stepId ?? "").trim().startsWith("preview-");
}
