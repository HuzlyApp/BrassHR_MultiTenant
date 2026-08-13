import type { SupabaseClient } from "@supabase/supabase-js";
import type { StepProgressRow, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { backfillFarthestReachedStepIndex } from "@/lib/onboarding/persist-farthest-reached-step";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

export type EnsureWorkerOnboardingProgressOptions = {
  /** When set, load/create progress for this job application (multi-app). */
  applicationId?: string | null;
};

type ProgressRow = {
  id: string;
  status: string | null;
  submitted_at: string | null;
  submitted_with_incomplete_steps: boolean | null;
  incomplete_step_keys: unknown;
  farthest_reached_step_index: number | null;
  application_id?: string | null;
};

/**
 * Ensures onboarding progress exists for a worker.
 * With `applicationId`, progress is scoped per job application so a new apply
 * starts with pending steps instead of inheriting another job's completions.
 * Without it, uses the legacy worker-scoped row (`application_id IS NULL`).
 */
export async function ensureWorkerOnboardingProgress(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string,
  options?: EnsureWorkerOnboardingProgressOptions
): Promise<WorkerOnboardingProgressPayload> {
  const applicationId = options?.applicationId?.trim() || null;
  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  if (!config) {
    throw new Error("No active onboarding configuration for tenant");
  }

  let existingQuery = supabase
    .from("worker_onboarding_progress")
    .select(
      "id, status, submitted_at, submitted_with_incomplete_steps, incomplete_step_keys, farthest_reached_step_index, application_id"
    )
    .eq("worker_id", workerId)
    .eq("onboarding_config_id", config.configId);

  if (applicationId) {
    existingQuery = existingQuery.eq("application_id", applicationId);
  } else {
    existingQuery = existingQuery.is("application_id", null);
  }

  const { data: found, error: exErr } = await existingQuery.maybeSingle();
  if (exErr) throw exErr;

  let existing: ProgressRow | null = found
    ? {
        id: String(found.id),
        status: found.status != null ? String(found.status) : null,
        submitted_at: found.submitted_at != null ? String(found.submitted_at) : null,
        submitted_with_incomplete_steps: Boolean(found.submitted_with_incomplete_steps),
        incomplete_step_keys: found.incomplete_step_keys,
        farthest_reached_step_index:
          found.farthest_reached_step_index != null
            ? Number(found.farthest_reached_step_index)
            : null,
        application_id: found.application_id != null ? String(found.application_id) : null,
      }
    : null;

  // Mid-migration: claim a legacy null-scoped incomplete row only for the first
  // in-progress application (never reuse a submitted row for a new job).
  if (!existing && applicationId) {
    const { data: legacy, error: legacyErr } = await supabase
      .from("worker_onboarding_progress")
      .select(
        "id, status, submitted_at, submitted_with_incomplete_steps, incomplete_step_keys, farthest_reached_step_index, application_id"
      )
      .eq("worker_id", workerId)
      .eq("onboarding_config_id", config.configId)
      .is("application_id", null)
      .maybeSingle();
    if (legacyErr) throw legacyErr;

    const legacySubmitted = Boolean(
      legacy?.submitted_at && String(legacy.submitted_at).trim()
    );

    if (legacy?.id && !legacySubmitted) {
      const { count: scopedCount, error: countErr } = await supabase
        .from("worker_onboarding_progress")
        .select("id", { count: "exact", head: true })
        .eq("worker_id", workerId)
        .eq("onboarding_config_id", config.configId)
        .not("application_id", "is", null);
      if (countErr) throw countErr;

      if ((scopedCount ?? 0) === 0) {
        const { data: claimed, error: claimErr } = await supabase
          .from("worker_onboarding_progress")
          .update({ application_id: applicationId, updated_at: new Date().toISOString() })
          .eq("id", legacy.id)
          .is("application_id", null)
          .select(
            "id, status, submitted_at, submitted_with_incomplete_steps, incomplete_step_keys, farthest_reached_step_index, application_id"
          )
          .maybeSingle();
        if (claimErr && claimErr.code !== "23505") throw claimErr;
        if (claimed?.id) {
          existing = {
            id: String(claimed.id),
            status: claimed.status != null ? String(claimed.status) : null,
            submitted_at: claimed.submitted_at != null ? String(claimed.submitted_at) : null,
            submitted_with_incomplete_steps: Boolean(claimed.submitted_with_incomplete_steps),
            incomplete_step_keys: claimed.incomplete_step_keys,
            farthest_reached_step_index:
              claimed.farthest_reached_step_index != null
                ? Number(claimed.farthest_reached_step_index)
                : null,
            application_id: claimed.application_id != null ? String(claimed.application_id) : null,
          };
        }
      }
    }
  }

  let progressId = existing?.id ?? null;
  let status = existing?.status ?? "in_progress";

  if (!progressId) {
    const insertRow: Record<string, unknown> = {
      worker_id: workerId,
      tenant_id: tenantId,
      onboarding_config_id: config.configId,
      status: "in_progress",
    };
    if (applicationId) {
      insertRow.application_id = applicationId;
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
  const stepKeyById = new Map(config.steps.map((s) => [s.id, s.step_key]));

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
        ...(applicationId ? { application_id: applicationId } : {}),
      }))
    );
    if (bulkErr) throw bulkErr;
  } else if (applicationId) {
    await supabase
      .from("worker_onboarding_step_progress")
      .update({ application_id: applicationId })
      .eq("worker_onboarding_progress_id", progressId)
      .is("application_id", null);
  }

  const { data: allSteps, error: allErr } = await supabase
    .from("worker_onboarding_step_progress")
    .select("onboarding_step_id, status, completed_at, data")
    .eq("worker_onboarding_progress_id", progressId)
    .in("onboarding_step_id", stepIds.length ? stepIds : ["00000000-0000-0000-0000-000000000000"]);

  if (allErr) throw allErr;

  const steps: StepProgressRow[] = (allSteps ?? []).map((r) => {
    const stepId = String(r.onboarding_step_id);
    return {
      onboarding_step_id: stepId,
      step_key: stepKeyById.get(stepId) ?? null,
      status: r.status as StepProgressRow["status"],
      completed_at: r.completed_at != null ? String(r.completed_at) : null,
      data: (r.data as Record<string, unknown>) ?? {},
    };
  });

  const persistedFarthest = Number(existing?.farthest_reached_step_index ?? 1);
  const payloadWithoutFarthest: WorkerOnboardingProgressPayload = {
    progressId: progressId!,
    status,
    steps,
    farthestReachedStepIndex: persistedFarthest,
    submittedAt: existing?.submitted_at ?? null,
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
