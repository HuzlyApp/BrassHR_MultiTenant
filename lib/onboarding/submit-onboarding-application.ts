import type { SupabaseClient } from "@supabase/supabase-js";
import { computeIncompleteStepKeys, stepTitlesForKeys } from "@/lib/onboarding/compute-incomplete-step-keys";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { resolveOnboardingWorker } from "@/lib/onboarding/resolve-onboarding-worker";
import type { WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

export type SubmitOnboardingApplicationInput = {
  applicantId: string;
  tenantSlug: string;
};

export type SubmitOnboardingApplicationResult =
  | {
      ok: true;
      submittedAt: string;
      submittedWithIncompleteSteps: boolean;
      incompleteStepKeys: string[];
      applicationStatus: string;
      progress: WorkerOnboardingProgressPayload;
    }
  | { ok: false; status: number; error: string };

export async function submitOnboardingApplication(
  supabase: SupabaseClient,
  input: SubmitOnboardingApplicationInput
): Promise<SubmitOnboardingApplicationResult> {
  const applicantId = input.applicantId.trim();
  const tenantSlug = input.tenantSlug.trim().toLowerCase();

  if (!applicantId) {
    return { ok: false, status: 400, error: "Missing applicantId" };
  }
  if (!tenantSlug || tenantSlug.length < 2) {
    return { ok: false, status: 400, error: "Missing tenant" };
  }

  const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug);
  if (!ctx) {
    return { ok: false, status: 404, error: "Worker not found for this tenant" };
  }

  const config = await loadTenantOnboardingConfig(supabase, ctx.tenantId, { workerFacing: true });
  if (!config) {
    return { ok: false, status: 400, error: "No onboarding configuration for tenant" };
  }

  const progress = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);

  if (progress.submittedAt) {
    return {
      ok: true,
      submittedAt: progress.submittedAt,
      submittedWithIncompleteSteps: Boolean(progress.submittedWithIncompleteSteps),
      incompleteStepKeys: progress.incompleteStepKeys ?? [],
      applicationStatus: progress.applicationStatus ?? "under_review",
      progress,
    };
  }

  const enabledSteps = config.steps.filter((s) => s.is_enabled);
  const requiredIncompleteKeys = computeIncompleteStepKeys(enabledSteps, progress.steps);
  if (requiredIncompleteKeys.length > 0) {
    const labels = stepTitlesForKeys(enabledSteps, requiredIncompleteKeys);
    return {
      ok: false,
      status: 400,
      error: `Please complete all required steps before submitting: ${labels.join(", ")}`,
    };
  }

  const incompleteStepKeys = computeIncompleteStepKeys(enabledSteps, progress.steps);
  const submittedWithIncompleteSteps = incompleteStepKeys.length > 0;
  const now = new Date().toISOString();

  const reviewStep = enabledSteps.find((s) => s.step_type === "review_submit");
  if (reviewStep) {
    const { error: reviewErr } = await supabase
      .from("worker_onboarding_step_progress")
      .update({
        status: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("worker_onboarding_progress_id", progress.progressId)
      .eq("onboarding_step_id", reviewStep.id);

    if (reviewErr) throw reviewErr;
  }

  const progressStatus =
    submittedWithIncompleteSteps ? "in_progress" : "completed";

  const { error: progressErr } = await supabase
    .from("worker_onboarding_progress")
    .update({
      status: progressStatus,
      completed_at: submittedWithIncompleteSteps ? null : now,
      submitted_at: now,
      submitted_with_incomplete_steps: submittedWithIncompleteSteps,
      incomplete_step_keys: incompleteStepKeys,
      updated_at: now,
    })
    .eq("id", progress.progressId);

  if (progressErr) throw progressErr;

  const applicationStatus = "under_review";
  const { error: workerErr } = await supabase
    .from("worker")
    .update({
      status: applicationStatus,
      updated_at: now,
    })
    .eq("id", ctx.workerId)
    .eq("tenant_id", ctx.tenantId);

  if (workerErr) throw workerErr;

  const refreshed = await ensureWorkerOnboardingProgress(supabase, ctx.workerId, ctx.tenantId);

  const payload: WorkerOnboardingProgressPayload = {
    ...refreshed,
    submittedAt: now,
    submittedWithIncompleteSteps,
    incompleteStepKeys,
    applicationStatus,
  };

  return {
    ok: true,
    submittedAt: payload.submittedAt ?? now,
    submittedWithIncompleteSteps,
    incompleteStepKeys,
    applicationStatus,
    progress: payload,
  };
}
