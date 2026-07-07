import { isUploadResumeStep } from "@/lib/onboarding/enforce-upload-resume-first";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

/** Whether an applicant may defer this step via Skip for Now. */
export function isOnboardingStepSkippable(
  step: Pick<TenantOnboardingStep, "step_type" | "step_key" | "metadata" | "is_required">
): boolean {
  if (isUploadResumeStep(step)) return false;
  if (step.step_type === "review_submit" || step.step_key === "review_submit") return false;

  const allowSkip = step.metadata?.allow_skip;
  if (allowSkip === false) return false;
  if (allowSkip === true || step.is_required === false) return true;

  // Required steps can be deferred during the applicant flow; submit still enforces completion.
  return true;
}
