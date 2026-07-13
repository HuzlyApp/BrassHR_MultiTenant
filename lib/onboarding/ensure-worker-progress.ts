import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepProgressRow, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";
import { loadApplicantWorkflowConfig } from "@/lib/job-requisitions/applicant-workflow-instance";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { backfillFarthestReachedStepIndex } from "@/lib/onboarding/persist-farthest-reached-step";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

export async function ensureWorkerOnboardingProgress(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<WorkerOnboardingProgressPayload> {
  const applicantConfig = await loadApplicantWorkflowConfig(supabase, workerId, tenantId);
  const tenantConfig = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  const config = applicantConfig ?? tenantConfig;
  if (!config || !tenantConfig) {
    throw new Error("No active onboarding configuration for tenant");
  }

  const usesFlowSteps = Boolean(applicantConfig);
  const progressConfigId = tenantConfig.configId;

  const { data: existing, error: exErr } = await supabase
    .from("worker_onboarding_progress")
    .select(
      "id, status, submitted_at, submitted_with_incomplete_steps, incomplete_step_keys, farthest_reached_step_index, applicant_workflow_instance_id, onboarding_flow_id"
    )
    .eq("worker_id", workerId)
    .eq("onboarding_config_id", progressConfigId)
    .maybeSingle();

  if (exErr) throw exErr;

  let progressId = existing?.id ? String(existing.id) : null;
  let status = existing?.status ? String(existing.status) : "in_progress";

  if (!progressId) {
    const insertRow: Record<string, unknown> = {
      worker_id: workerId,
      tenant_id: tenantId,
      onboarding_config_id: progressConfigId,
      status: "in_progress",
    };
    if (usesFlowSteps) {
      const { data: workerRow } = await supabase
        .from("worker")
        .select("applicant_workflow_instance_id, onboarding_flow_id")
        .eq("id", workerId)
        .maybeSingle();
      if (workerRow?.applicant_workflow_instance_id) {
        insertRow.applicant_workflow_instance_id = workerRow.applicant_workflow_instance_id;
      }
      if (workerRow?.onboarding_flow_id) {
        insertRow.onboarding_flow_id = workerRow.onboarding_flow_id;
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("worker_onboarding_progress")
      .insert(insertRow)
      .select("id, status")
      .single();

    if (insErr) throw insErr;
    progressId = String(inserted.id);
    status = String(inserted.status);
  }

  const enabledSteps = getEnabledTenantSteps(config);
  const stepIds = enabledSteps.map((s) => s.id);

  const { data: stepRows, error: srErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("onboarding_step_id, flow_step_id, status, completed_at, data")
    .eq("worker_onboarding_progress_id", progressId);

  if (srErr) throw srErr;

  const existingStepIds = new Set(
    (stepRows ?? []).map((r) =>
      r.flow_step_id ? String(r.flow_step_id) : String(r.onboarding_step_id)
    )
  );
  const missing = enabledSteps.filter((s) => !existingStepIds.has(s.id));

  if (missing.length) {
    const { error: bulkErr } = await supabase.from("worker_onboarding_step_progress").insert(
      missing.map((s) => ({
        worker_onboarding_progress_id: progressId,
        worker_id: workerId,
        tenant_id: tenantId,
        onboarding_step_id: usesFlowSteps ? null : s.id,
        flow_step_id: usesFlowSteps ? s.id : null,
        status: "pending",
      }))
    );
    if (bulkErr) throw bulkErr;
  }

  const { data: allSteps, error: allErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("onboarding_step_id, flow_step_id, status, completed_at, data")
    .eq("worker_onboarding_progress_id", progressId);

  if (allErr) throw allErr;

  const steps: StepProgressRow[] = (allSteps ?? [])
    .map((r) => ({
      onboarding_step_id: String(r.flow_step_id ?? r.onboarding_step_id),
      status: r.status as StepProgressRow["status"],
      completed_at: r.completed_at != null ? String(r.completed_at) : null,
      data: (r.data as Record<string, unknown>) ?? {},
    }))
    .filter((r) => stepIds.includes(r.onboarding_step_id));

  const persistedFarthest = Number(existing?.farthest_reached_step_index ?? 1);
  const payloadWithoutFarthest: WorkerOnboardingProgressPayload = {
    progressId: progressId!,
    status,
    steps,
    farthestReachedStepIndex: persistedFarthest,
    submittedAt: existing?.submitted_at != null ? String(existing.submitted_at) : null,
    submittedWithIncompleteSteps: Boolean(existing?.submitted_with_incomplete_steps),
    incompleteStepKeys: Array.isArray(existing?.incomplete_step_keys)
      ? (existing.incomplete_step_keys as string[])
      : [],
  };

  const farthestReachedStepIndex = await backfillFarthestReachedStepIndex(
    supabase,
    progressId!,
    config,
    payloadWithoutFarthest
  );

  return {
    ...payloadWithoutFarthest,
    farthestReachedStepIndex,
  };
}
