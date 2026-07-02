import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFarthestReachedIndexFromSteps, nextFarthestReachedIndex } from "@/lib/onboarding/farthest-reached-step";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type {
  OnboardingStepStatus,
  TenantOnboardingConfig,
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";

export async function persistFarthestReachedStepIndex(
  supabase: SupabaseClient,
  progressId: string,
  enabledSteps: TenantOnboardingStep[],
  stepId: string,
  status: OnboardingStepStatus,
  currentFarthest: number
): Promise<number> {
  const next = nextFarthestReachedIndex(enabledSteps, stepId, status, currentFarthest);
  if (next <= currentFarthest) return currentFarthest;

  const { error } = await supabase
    .from("worker_onboarding_progress")
    .update({
      farthest_reached_step_index: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) throw error;
  return next;
}

export async function backfillFarthestReachedStepIndex(
  supabase: SupabaseClient,
  progressId: string,
  config: TenantOnboardingConfig,
  progress: WorkerOnboardingProgressPayload
): Promise<number> {
  const enabledSteps = getEnabledTenantSteps(config);
  const derived = computeFarthestReachedIndexFromSteps(enabledSteps, progress);
  const persisted = progress.farthestReachedStepIndex ?? 1;
  const next = Math.max(persisted, derived, 1);

  if (next > persisted) {
    const { error } = await supabase
      .from("worker_onboarding_progress")
      .update({
        farthest_reached_step_index: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progressId);
    if (error) throw error;
  }

  return next;
}
