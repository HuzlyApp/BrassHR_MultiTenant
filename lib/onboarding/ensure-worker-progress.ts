import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepProgressRow, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";

export async function ensureWorkerOnboardingProgress(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<WorkerOnboardingProgressPayload> {
  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  if (!config) {
    throw new Error("No active onboarding configuration for tenant");
  }

  const { data: existing, error: exErr } = await supabase
    .from("worker_onboarding_progress")
    .select("id, status, submitted_at, submitted_with_incomplete_steps, incomplete_step_keys")
    .eq("worker_id", workerId)
    .eq("onboarding_config_id", config.configId)
    .maybeSingle();

  if (exErr) throw exErr;

  let progressId = existing?.id ? String(existing.id) : null;
  let status = existing?.status ? String(existing.status) : "in_progress";

  if (!progressId) {
    const { data: inserted, error: insErr } = await supabase
      .from("worker_onboarding_progress")
      .insert({
        worker_id: workerId,
        tenant_id: tenantId,
        onboarding_config_id: config.configId,
        status: "in_progress",
      })
      .select("id, status")
      .single();

    if (insErr) throw insErr;
    progressId = String(inserted.id);
    status = String(inserted.status);
  }

  const enabledSteps = config.steps.filter((s) => s.is_enabled);
  const stepIds = enabledSteps.map((s) => s.id);

  const { data: stepRows, error: srErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("onboarding_step_id, status, completed_at, data")
    .eq("worker_onboarding_progress_id", progressId);

  if (srErr) throw srErr;

  const existingStepIds = new Set((stepRows ?? []).map((r) => String(r.onboarding_step_id)));
  const missing = enabledSteps.filter((s) => !existingStepIds.has(s.id));

  if (missing.length) {
    const { error: bulkErr } = await supabase.from("worker_onboarding_step_progress").insert(
      missing.map((s) => ({
        worker_onboarding_progress_id: progressId,
        worker_id: workerId,
        tenant_id: tenantId,
        onboarding_step_id: s.id,
        status: "pending",
      }))
    );
    if (bulkErr) throw bulkErr;
  }

  const { data: allSteps, error: allErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("onboarding_step_id, status, completed_at, data")
    .eq("worker_onboarding_progress_id", progressId)
    .in("onboarding_step_id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"]);

  if (allErr) throw allErr;

  const steps: StepProgressRow[] = (allSteps ?? []).map((r) => ({
    onboarding_step_id: String(r.onboarding_step_id),
    status: r.status as StepProgressRow["status"],
    completed_at: r.completed_at != null ? String(r.completed_at) : null,
    data: (r.data as Record<string, unknown>) ?? {},
  }));

  return {
    progressId: progressId!,
    status,
    steps,
    submittedAt: existing?.submitted_at != null ? String(existing.submitted_at) : null,
    submittedWithIncompleteSteps: Boolean(existing?.submitted_with_incomplete_steps),
    incompleteStepKeys: Array.isArray(existing?.incomplete_step_keys)
      ? (existing.incomplete_step_keys as string[])
      : [],
  };
}
