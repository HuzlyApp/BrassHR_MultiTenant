"use client";

import { useEffect, useRef } from "react";
import { applicantStepHasNavigableScreen } from "@/lib/onboarding/applicant-step-navigability";
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
 * Auto-completes workflow placeholders that have no applicant screen
 * (e.g. Parameterized Job Application) so they persist as completed, not skipped.
 */
export function useAutoSkipNonNavigableApplicantSteps(
  enabledSteps: TenantOnboardingStep[] | null | undefined,
  progress: WorkerOnboardingProgressPayload | null | undefined,
  updateStepStatus?: UpdateStepStatusFn
) {
  const completedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabledSteps?.length || !updateStepStatus) return;

    const statusByStepId = buildProgressStatusMaps(enabledSteps, progress ?? null);

    for (const step of enabledSteps) {
      if (applicantStepHasNavigableScreen(step, enabledSteps)) continue;
      if (completedKeysRef.current.has(step.step_key)) continue;

      const status = statusByStepId.get(step.id) ?? "pending";
      if (status !== "pending" && status !== "in_progress" && status !== "skipped") continue;

      // Upgrade legacy system-skips of required placeholders to completed.
      if (status === "skipped") {
        completedKeysRef.current.add(step.step_key);
        void persistStepProgress(
          updateStepStatus,
          step.step_key,
          "completed",
          undefined,
          { ...NON_NAVIGABLE_SYSTEM_COMPLETE_DATA, upgraded_from: "skipped" }
        ).catch(() => {
          completedKeysRef.current.delete(step.step_key);
        });
        continue;
      }

      completedKeysRef.current.add(step.step_key);
      void persistStepProgress(
        updateStepStatus,
        step.step_key,
        "completed",
        undefined,
        { ...NON_NAVIGABLE_SYSTEM_COMPLETE_DATA }
      ).catch(() => {
        completedKeysRef.current.delete(step.step_key);
      });
    }
  }, [enabledSteps, progress, updateStepStatus]);
}
