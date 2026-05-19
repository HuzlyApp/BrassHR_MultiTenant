import type { OnboardingStepType } from "@/lib/onboarding/types";
import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";

export function stepIndexFromPathname(
  pathname: string,
  steps: { step_key: string; step_type: OnboardingStepType }[]
): number {
  const p = pathname || "";
  for (let i = 0; i < steps.length; i++) {
    const route = routeForOnboardingStep(steps[i].step_key, steps[i].step_type);
    if (p.startsWith(route) || p.includes(route)) return i + 1;
    if (steps[i].step_key === "resume_upload" && p.includes("/application/step-1-")) return i + 1;
    if (steps[i].step_type === "professional_license" && p.includes("/application/step-2-")) return i + 1;
    if (steps[i].step_key === "professional_license" && p.includes("/application/step-2-")) return i + 1;
    if (steps[i].step_type === "skill_assessment" && p.includes("/application/step-3-")) return i + 1;
    if (steps[i].step_key === "skill_assessment" && p.includes("/application/step-3-")) return i + 1;
    if (steps[i].step_type === "authorizations" || steps[i].step_key === "authorizations") {
      if (
        p.includes("/application/step-4-") ||
        p.includes("/application/employee-agreement") ||
        p.includes("/application/upload-form")
      ) {
        return i + 1;
      }
    }
    if (steps[i].step_type === "references" && p.includes("/application/step-5-")) return i + 1;
    if (steps[i].step_type === "review_submit" && p.includes("/application/step-6-")) return i + 1;
  }
  return 1;
}
