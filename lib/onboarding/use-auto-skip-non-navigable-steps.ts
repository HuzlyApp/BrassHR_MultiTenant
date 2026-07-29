"use client";

import { useEffect, useRef } from "react";
import { applicantStepHasNavigableScreen } from "@/lib/onboarding/applicant-step-navigability";
import { buildProgressStatusMaps } from "@/lib/onboarding/compute-max-allowed-from-progress";
import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import type { TenantOnboardingStep, WorkerOnboardingProgressPayload } from "@/lib/onboarding/types";

type UpdateStepStatusFn = (
  stepKey: string,
  status: "pending" | "in_progress" | "completed" | "skipped",
  data?: Record<string, unknown>
) => Promise<void>;

/** Auto-skips workflow steps that have no applicant screen (e.g. Parameterized Job Application). */
export function useAutoSkipNonNavigableApplicantSteps(
  enabledSteps: TenantOnboardingStep[] | null | undefined,
  progress: WorkerOnboardingProgressPayload | null | undefined,
  updateStepStatus?: UpdateStepStatusFn
) {
  const skippedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabledSteps?.length || !updateStepStatus) return;

    const statusByStepId = buildProgressStatusMaps(enabledSteps, progress ?? null);

    for (const step of enabledSteps) {
      if (applicantStepHasNavigableScreen(step, enabledSteps)) continue;
      if (skippedKeysRef.current.has(step.step_key)) continue;

      const status = statusByStepId.get(step.id) ?? "pending";
      if (status !== "pending" && status !== "in_progress") continue;

      skippedKeysRef.current.add(step.step_key);
      void persistStepProgress(updateStepStatus, step.step_key, "skipped").catch(() => {
        skippedKeysRef.current.delete(step.step_key);
      });
    }
  }, [enabledSteps, progress, updateStepStatus]);
}
