import type {
  OnboardingStepStatus,
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";
import { buildProgressStatusMaps } from "@/lib/onboarding/compute-max-allowed-from-progress";

export type ApplicantNavBoundaries = {
  /** Highest step index the applicant has ever reached (1-based). */
  farthestReachedIndex: number;
  /** Furthest step index reachable by natural forward progress today. */
  naturalFrontierIndex: number;
};

function indexFromStepId(
  enabledSteps: TenantOnboardingStep[],
  stepId: string
): number {
  const idx = enabledSteps.findIndex((step) => step.id === stepId);
  return idx >= 0 ? idx + 1 : 0;
}

/**
 * Derive farthest reached index from saved step rows when the persisted column is missing or stale.
 */
export function computeFarthestReachedIndexFromSteps(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null
): number {
  if (!enabledSteps.length) return 1;

  const statusByStepId = buildProgressStatusMaps(enabledSteps, progress);
  let farthest = 1;

  for (let i = 0; i < enabledSteps.length; i++) {
    const st = statusByStepId.get(enabledSteps[i]!.id) ?? "pending";
    const stepNumber = i + 1;

    if (st === "in_progress" || st === "completed" || st === "skipped") {
      farthest = Math.max(farthest, stepNumber);
    }
    if (st === "completed" || st === "skipped") {
      farthest = Math.max(farthest, Math.min(stepNumber + 1, enabledSteps.length));
    }
  }

  return Math.min(farthest, enabledSteps.length);
}

/** Next index to persist after a step status change. */
export function nextFarthestReachedIndex(
  enabledSteps: TenantOnboardingStep[],
  stepId: string,
  status: OnboardingStepStatus,
  currentFarthest: number
): number {
  const stepIndex = indexFromStepId(enabledSteps, stepId);
  if (stepIndex <= 0) return currentFarthest;

  let next = currentFarthest;
  if (status === "in_progress" || status === "completed" || status === "skipped") {
    next = Math.max(next, stepIndex);
  }
  if (status === "completed" || status === "skipped") {
    next = Math.max(next, Math.min(stepIndex + 1, enabledSteps.length));
  }

  return Math.min(next, enabledSteps.length);
}

export function resolveApplicantNavBoundaries(
  enabledSteps: TenantOnboardingStep[],
  progress: WorkerOnboardingProgressPayload | null,
  naturalFrontierIndex: number
): ApplicantNavBoundaries {
  const derived = computeFarthestReachedIndexFromSteps(enabledSteps, progress);
  const persisted = progress?.farthestReachedStepIndex ?? 1;
  const farthestReachedIndex = Math.min(
    enabledSteps.length || 1,
    Math.max(persisted, derived, 1)
  );

  return {
    farthestReachedIndex,
    naturalFrontierIndex: Math.min(
      enabledSteps.length || 1,
      Math.max(naturalFrontierIndex, 1)
    ),
  };
}

export function stepKeyAtIndex(
  enabledSteps: TenantOnboardingStep[],
  stepIndex: number
): string | null {
  return enabledSteps[Math.max(0, stepIndex - 1)]?.step_key ?? null;
}
