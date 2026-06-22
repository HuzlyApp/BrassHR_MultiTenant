import type { OnboardingStepType } from "@/lib/onboarding/types";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import {
  resolveApplicantStepFromPath,
  stepIndexForApplicantStep,
} from "@/lib/onboarding/find-applicant-step";

export function stepIndexFromPathname(
  pathname: string,
  steps: { step_key: string; step_type: OnboardingStepType }[],
  search?: string
): number {
  const enabled = steps as TenantOnboardingStep[];
  const searchStr =
    search ??
    (typeof window !== "undefined" ? window.location.search : "");
  const step = resolveApplicantStepFromPath(pathname, searchStr, enabled);
  return stepIndexForApplicantStep(step, enabled);
}
