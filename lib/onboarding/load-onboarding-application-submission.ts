import type { SupabaseClient } from "@supabase/supabase-js";
import { stepTitlesForKeys } from "@/lib/onboarding/compute-incomplete-step-keys";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";

export type OnboardingApplicationSubmission = {
  submittedAt: string;
  submittedWithIncompleteSteps: boolean;
  incompleteStepKeys: string[];
  incompleteStepLabels: string[];
};

export async function loadOnboardingApplicationSubmission(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<OnboardingApplicationSubmission | null> {
  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  if (!config) return null;

  const progress = await ensureWorkerOnboardingProgress(supabase, workerId, tenantId);
  if (!progress.submittedAt) return null;

  const incompleteStepKeys = progress.incompleteStepKeys ?? [];
  return {
    submittedAt: progress.submittedAt,
    submittedWithIncompleteSteps: Boolean(progress.submittedWithIncompleteSteps),
    incompleteStepKeys,
    incompleteStepLabels: stepTitlesForKeys(
      config.steps.filter((s) => s.is_enabled),
      incompleteStepKeys
    ),
  };
}
