import type { OnboardingStepType } from "@/lib/onboarding/types";
import { APPLICATION_ROUTE_STEP_MARKERS } from "@/lib/onboarding/application-routes";
import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";

function pathnameMatchesStepGroup(
  pathname: string,
  step: { step_key: string; step_type: OnboardingStepType },
  marker: (typeof APPLICATION_ROUTE_STEP_MARKERS)[number]
): boolean {
  if (marker.stepKey && step.step_key !== marker.stepKey) return false;
  if (marker.stepType && step.step_type !== marker.stepType) return false;
  return marker.pathIncludes.some((fragment) => pathname.includes(fragment));
}

export function stepIndexFromPathname(
  pathname: string,
  steps: { step_key: string; step_type: OnboardingStepType }[]
): number {
  const p = pathname || "";
  for (let i = 0; i < steps.length; i++) {
    const route = routeForOnboardingStep(steps[i].step_key, steps[i].step_type);
    if (p.startsWith(route) || p.includes(route)) return i + 1;

    for (const marker of APPLICATION_ROUTE_STEP_MARKERS) {
      if (pathnameMatchesStepGroup(p, steps[i], marker)) return i + 1;
    }
  }
  return 1;
}
