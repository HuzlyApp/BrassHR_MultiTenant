"use client";

import {
  applicantStepHasNavigableScreen,
  nonNavigableStepsBetween,
} from "@/lib/onboarding/applicant-step-navigability";
import { NON_NAVIGABLE_SYSTEM_COMPLETE_DATA } from "@/lib/onboarding/complete-non-navigable-step";
import { buildProgressStatusMaps } from "@/lib/onboarding/compute-max-allowed-from-progress";
import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import type { OnboardingStepStatus, TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

type UpdateStepStatusFn = (
  stepKey: string,
  status: OnboardingStepStatus,
  data?: Record<string, unknown>
) => Promise<void>;

/**
 * Marks pending/in-progress placeholder steps (no applicant screen) as completed.
 * These are system advances, not applicant "Skip for Now" — required placeholders must
 * not remain `skipped` (which maps to the orange required_missing indicator).
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
  const toComplete =
    afterIndex !== undefined && beforeIndex !== undefined
      ? nonNavigableStepsBetween(enabledSteps, afterIndex, beforeIndex)
      : enabledSteps.filter(
          (step) =>
            !applicantStepHasNavigableScreen(step, enabledSteps) &&
            ["pending", "in_progress"].includes(statusByStepId.get(step.id) ?? "pending")
        );

  for (const step of toComplete) {
    const status = statusByStepId.get(step.id) ?? "pending";
    if (status !== "pending" && status !== "in_progress") continue;
    try {
      await persistStepProgress(
        updateStepStatus,
        step.step_key,
        "completed",
        undefined,
        { ...NON_NAVIGABLE_SYSTEM_COMPLETE_DATA }
      );
    } catch {
      /* best-effort */
    }
  }
}
