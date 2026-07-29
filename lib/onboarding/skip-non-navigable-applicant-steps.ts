"use client";

import {
  applicantStepHasNavigableScreen,
  nonNavigableStepsBetween,
} from "@/lib/onboarding/applicant-step-navigability";
import { buildProgressStatusMaps } from "@/lib/onboarding/compute-max-allowed-from-progress";
import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import type { OnboardingStepStatus, TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

type UpdateStepStatusFn = (
  stepKey: string,
  status: OnboardingStepStatus,
  data?: Record<string, unknown>
) => Promise<void>;

/**
 * Marks pending/in-progress steps without applicant screens as skipped.
 */
export async function skipNonNavigableApplicantSteps(options: {
  enabledSteps: TenantOnboardingStep[];
  progress?: WorkerOnboardingProgressPayload | null;
  updateStepStatus?: UpdateStepStatusFn;
  afterIndex?: number;
  beforeIndex?: number;
}): Promise<void> {
  const { enabledSteps, progress, updateStepStatus, afterIndex, beforeIndex } = options;
  if (!updateStepStatus || !enabledSteps.length) return;

  const statusByStepId = buildProgressStatusMaps(enabledSteps, progress ?? null);
  const toSkip =
    afterIndex !== undefined && beforeIndex !== undefined
      ? nonNavigableStepsBetween(enabledSteps, afterIndex, beforeIndex)
      : enabledSteps.filter(
          (step) =>
            !applicantStepHasNavigableScreen(step, enabledSteps) &&
            ["pending", "in_progress"].includes(statusByStepId.get(step.id) ?? "pending")
        );

  for (const step of toSkip) {
    const status = statusByStepId.get(step.id) ?? "pending";
    if (status !== "pending" && status !== "in_progress") continue;
    try {
      await persistStepProgress(updateStepStatus, step.step_key, "skipped");
    } catch {
      /* best-effort */
    }
  }
}
