import type { SupabaseClient } from "@supabase/supabase-js";
import { NON_NAVIGABLE_SYSTEM_COMPLETE_DATA } from "@/lib/onboarding/complete-non-navigable-step";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type { OnboardingStepType, TenantOnboardingStep } from "@/lib/onboarding/types";

async function markEnabledStepCompleted(
  supabase: SupabaseClient,
  input: {
    workerId: string;
    tenantId: string;
    step: TenantOnboardingStep;
    applicationId?: string | null;
    configSteps?: TenantOnboardingStep[];
    data?: Record<string, unknown>;
  }
): Promise<void> {
  const progress = await ensureWorkerOnboardingProgress(
    supabase,
    input.workerId,
    input.tenantId,
    input.applicationId
  );

  const existing = progress.steps.find((row) => row.onboarding_step_id === input.step.id);
  if (existing?.status === "completed") return;

  const now = new Date().toISOString();
  const data = input.data ?? {};
  if (!existing) {
    const { error: insertErr } = await supabase.from("worker_onboarding_step_progress").insert({
      worker_onboarding_progress_id: progress.progressId,
      worker_id: input.workerId,
      tenant_id: input.tenantId,
      onboarding_step_id: input.step.id,
      status: "completed",
      completed_at: now,
      data,
    });
    if (insertErr && insertErr.code !== "23505") throw insertErr;
  }

  const { error: updateErr } = await supabase
    .from("worker_onboarding_step_progress")
    .update({
      status: "completed",
      completed_at: now,
      updated_at: now,
      data,
    })
    .eq("worker_onboarding_progress_id", progress.progressId)
    .eq("onboarding_step_id", input.step.id)
    .neq("status", "completed");

  if (updateErr) throw updateErr;

  if (input.configSteps?.length) {
    const stepIdx = input.configSteps.findIndex((s) => s.id === input.step.id || s.step_key === input.step.step_key);
    if (stepIdx >= 0) {
      await supabase
        .from("worker_onboarding_progress")
        .update({
          farthest_reached_step_index: Math.max(
            progress.farthestReachedStepIndex ?? 1,
            stepIdx + 2
          ),
          updated_at: now,
        })
        .eq("id", progress.progressId);
    }
  }
}

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

  await markEnabledStepCompleted(supabase, {
    workerId: input.workerId,
    tenantId: input.tenantId,
    step,
    configSteps: enabled,
  });
}

/**
 * Completes a builder-library placeholder (e.g. parameterized-job-application)
 * after its real submission path succeeds.
 */
export async function markTenantStepCompletedByWorkflowLibraryId(
  supabase: SupabaseClient,
  input: {
    workerId: string;
    tenantId: string;
    workflowStepId: string;
    applicationId?: string | null;
    jobToken?: string | null;
    data?: Record<string, unknown>;
  }
): Promise<void> {
  let config = await loadTenantOnboardingConfig(supabase, input.tenantId, {
    workerFacing: true,
  });

  if (input.jobToken) {
    try {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", input.tenantId)
        .maybeSingle();
      const { loadApplicantConfigForJobToken } = await import(
        "@/lib/onboarding/load-config-for-job-workflow"
      );
      const jobConfig = await loadApplicantConfigForJobToken(
        supabase,
        tenant?.slug ?? null,
        input.jobToken
      );
      if (jobConfig.config?.steps?.length) {
        config = jobConfig.config;
      }
    } catch {
      // Keep tenant config
    }
  }

  if (!config) return;

  const enabled = getEnabledTenantSteps(config);
  const normalizedTarget = input.workflowStepId.trim().toLowerCase().replaceAll("_", "-");

  const step =
    enabled.find((s) => {
      const id = s.metadata?.workflow_step_id;
      if (typeof id === "string" && id.trim().toLowerCase().replaceAll("_", "-") === normalizedTarget) {
        return true;
      }
      const key = s.step_key?.toLowerCase().replaceAll("_", "-");
      if (key === normalizedTarget || key?.replace(/-\d+$/, "") === normalizedTarget) {
        return true;
      }
      if (s.id === input.workflowStepId) return true;
      if (
        normalizedTarget === "parameterized-job-application" &&
        (s.step_type === "profile_information" || s.step_key === "parameterized_job_application")
      ) {
        return true;
      }
      return false;
    }) ?? null;

  if (!step) return;

  await markEnabledStepCompleted(supabase, {
    workerId: input.workerId,
    tenantId: input.tenantId,
    applicationId: input.applicationId,
    step,
    configSteps: enabled,
    data: {
      ...NON_NAVIGABLE_SYSTEM_COMPLETE_DATA,
      ...(input.data ?? {}),
    },
  });
}
