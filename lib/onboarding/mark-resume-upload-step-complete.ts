"use client";

import { persistStepProgress } from "@/lib/onboarding/use-mark-step-in-progress-if-pending";
import type {
  OnboardingStepStatus,
  TenantOnboardingConfig,
  TenantOnboardingStep,
} from "@/lib/onboarding/types";

type UpdateStepStatusFn = (
  stepKey: string,
  status: OnboardingStepStatus,
  data?: Record<string, unknown>
) => Promise<void>;

export function findResumeUploadStep(
  config: TenantOnboardingConfig | null | undefined
): TenantOnboardingStep | null {
  const steps = (config?.steps ?? []).filter((s) => s.is_enabled !== false);
  return (
    steps.find((s) => s.step_type === "resume_upload" || s.step_key === "resume_upload") ??
    null
  );
}

export function readLocalResumeUploadPath(): string | null {
  if (typeof window === "undefined") return null;
  const path = localStorage.getItem("resumeStoragePath")?.trim();
  if (path) return path;
  const name = localStorage.getItem("resumeName")?.trim();
  return name || null;
}

export function hasLocalResumeUpload(): boolean {
  return readLocalResumeUploadPath() != null;
}

/** Marks the resume upload workflow step complete once a resume file is on record. */
export async function markResumeUploadStepComplete(params: {
  updateStepStatus?: UpdateStepStatusFn;
  config?: TenantOnboardingConfig | null;
  resumePath?: string | null;
  currentStatus?: OnboardingStepStatus | string | null;
}): Promise<void> {
  const { updateStepStatus, config, resumePath, currentStatus } = params;
  if (!updateStepStatus) return;
  if (currentStatus === "completed" || currentStatus === "skipped") return;

  const resumeStep = findResumeUploadStep(config);
  const stepKey = resumeStep?.step_key ?? "resume_upload";
  const path = resumePath?.trim() || readLocalResumeUploadPath();
  if (!path) return;

  await persistStepProgress(updateStepStatus, stepKey, "completed", undefined, {
    resume_path: path,
  });
}
