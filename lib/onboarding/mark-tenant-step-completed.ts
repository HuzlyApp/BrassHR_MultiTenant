import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { OnboardingStepType } from "@/lib/onboarding/types";

/**
 * Marks the first matching enabled tenant step as completed for a worker.
 * Used when a dedicated save API has already verified step requirements.
 */
export async function markTenantStepCompletedByType(
  supabase: SupabaseClient,
  input: {
    workerId: string;
    tenantId: string;
    stepType: OnboardingStepType;
    stepKey?: string;
  }
): Promise<void> {
  const config = await loadTenantOnboardingConfig(supabase, input.tenantId, {
    workerFacing: true,
  });
  if (!config) return;

  const enabled = getEnabledTenantSteps(config);
  const step =
    (input.stepKey
      ? enabled.find((s) => s.step_key === input.stepKey) ??
        enabled.find((s) => s.step_key.replace(/_\d+$/, "") === input.stepKey!.replace(/_\d+$/, ""))
      : null) ??
    enabled.find((s) => s.step_type === input.stepType) ??
    null;

  if (!step) return;

  const progress = await ensureWorkerOnboardingProgress(
    supabase,
    input.workerId,
    input.tenantId
  );

  const existing = progress.steps.find((row) => row.onboarding_step_id === step.id);
  if (existing?.status === "completed") return;

  const now = new Date().toISOString();
  if (!existing) {
    const { error: insertErr } = await supabase.from("worker_onboarding_step_progress").insert({
      worker_onboarding_progress_id: progress.progressId,
      worker_id: input.workerId,
      tenant_id: input.tenantId,
      onboarding_step_id: step.id,
      status: "completed",
      completed_at: now,
      data: {},
    });
    if (insertErr && insertErr.code !== "23505") throw insertErr;
  }

  const { error: updateErr } = await supabase
    .from("worker_onboarding_step_progress")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
    })
    .eq("worker_onboarding_progress_id", progress.progressId)
    .eq("onboarding_step_id", step.id)
    .neq("status", "completed");

  if (updateErr) throw updateErr;
}
