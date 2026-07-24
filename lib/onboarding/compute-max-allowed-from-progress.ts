import { isUploadResumeStep } from "@/lib/onboarding/enforce-upload-resume-first";
import type {
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";

type StepPhase = "pre_hire" | "transition" | "post_hire";

function readStepPhase(step: TenantOnboardingStep): StepPhase {
  const fromSettings =
    step.metadata?.workflow_settings &&
    typeof step.metadata.workflow_settings === "object" &&
    !Array.isArray(step.metadata.workflow_settings)
      ? (step.metadata.workflow_settings as Record<string, unknown>).phase
      : undefined;
  const phase =
    fromSettings ??
    (typeof step.metadata?.phase === "string" ? step.metadata.phase : undefined);
  if (phase === "transition" || phase === "post_hire") return phase;
  return "pre_hire";
}

function isPostHireUnlocked(progress: WorkerOnboardingProgressPayload | null): boolean {
  const appStatus = String(progress?.applicationStatus ?? "").toLowerCase();
  if (appStatus === "approved" || appStatus === "hired" || appStatus === "active") return true;
  for (const step of progress?.steps ?? []) {
    if (step.data?.transition_approved === true || step.data?.post_hire_unlocked === true) {
      return true;
    }
  }
  return false;
}

export function buildProgressStatusMaps(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null
): Map<string, string> {
  const byStepId = new Map(
    (progress?.steps ?? []).map((p) => [p.onboarding_step_id, p.status])
  );
  const byStepKey = new Map<string, string>();

  for (const row of progress?.steps ?? []) {
    const step = enabledSteps.find((s) => s.id === row.onboarding_step_id);
    if (step) {
      byStepKey.set(step.step_key, row.status);
    }
  }

  return new Map(
    enabledSteps.map((step) => {
      const status =
        byStepId.get(step.id) ??
        byStepKey.get(step.step_key) ??
        "pending";
      return [step.id, status] as const;
    })
  );
}

/**
 * Highest 1-based step index the applicant may access based on saved DB progress only.
 * Matches progress by step id first, then step_key for resilience across config republishes.
 */
export function computeMaxAllowedStepIndexFromProgress(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null
): number {
  if (!enabledSteps.length) return 1;

  const statusByStepId = buildProgressStatusMaps(enabledSteps, progress);
  const postHireUnlocked = isPostHireUnlocked(progress);

  let max = 1;

  if (progress?.steps?.length) {
    for (let i = 0; i < enabledSteps.length; i++) {
      const phase = readStepPhase(enabledSteps[i]!);
      if (phase === "post_hire" && !postHireUnlocked) {
        max = Math.max(max, i);
        break;
      }
      const st = statusByStepId.get(enabledSteps[i]!.id);
      if (st === "completed" || st === "skipped") {
        if (st === "skipped" && isUploadResumeStep(enabledSteps[i]!)) {
          max = Math.max(max, i + 1);
          break;
        }
        max = Math.max(max, i + 2);
      } else if (st === "in_progress") {
        max = Math.max(max, i + 1);
        break;
      } else if (!enabledSteps[i]!.is_required) {
        max = Math.max(max, i + 2);
      } else {
        max = Math.max(max, i + 1);
        break;
      }
    }

    // Allow any step already started (e.g. authorizations in_progress while an optional prior step was skipped in UI).
    for (let i = 0; i < enabledSteps.length; i++) {
      const st = statusByStepId.get(enabledSteps[i]!.id);
      if (st === "in_progress" || st === "completed" || st === "skipped") {
        max = Math.max(max, i + 1);
      }
    }
  }

  return Math.min(max, enabledSteps.length);
}

export function resolveNextIncompleteStepIndex(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null
): number {
  if (!enabledSteps.length) return 1;

  const statusByStepId = buildProgressStatusMaps(enabledSteps, progress);

  for (let i = 0; i < enabledSteps.length; i++) {
    const st = statusByStepId.get(enabledSteps[i]!.id) ?? "pending";
    if (st !== "completed" && st !== "skipped") {
      return i + 1;
    }
  }

  return enabledSteps.length;
}

/** DB status for a configured step (by id, falling back to step_key). */
export function progressStatusForStep(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null,
  step: TenantOnboardingStep
): string {
  return buildProgressStatusMaps(enabledSteps, progress).get(step.id) ?? "pending";
}
