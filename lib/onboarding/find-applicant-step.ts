import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import { APPLICATION_ROUTE_STEP_MARKERS } from "@/lib/onboarding/application-routes";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";

export function readStepKeyFromSearch(search: string): string | null {
  const key = new URLSearchParams(search).get("stepKey")?.trim();
  return key || null;
}

export function findApplicantStepByKey(
  steps: TenantOnboardingStep[],
  stepKey: string | null | undefined
): TenantOnboardingStep | null {
  if (!stepKey?.trim()) return null;
  return steps.find((s) => s.step_key === stepKey) ?? null;
}

function pathnameMatchesStepGroup(
  pathname: string,
  step: TenantOnboardingStep,
  marker: (typeof APPLICATION_ROUTE_STEP_MARKERS)[number]
): boolean {
  if (marker.stepKey && step.step_key !== marker.stepKey) return false;
  if (marker.stepType && step.step_type !== marker.stepType) return false;
  return marker.pathIncludes.some((fragment) => pathname.includes(fragment));
}

/** Resolve which enabled step the applicant is on from URL + optional stepKey query. */
export function resolveApplicantStepFromPath(
  pathname: string,
  search: string,
  steps: TenantOnboardingStep[]
): TenantOnboardingStep | null {
  if (!steps.length) return null;

  const stepKey = readStepKeyFromSearch(search);
  if (stepKey) {
    const byKey = findApplicantStepByKey(steps, stepKey);
    if (byKey) return byKey;
  }

  const p = pathname || "";

  if (p.includes("/application/custom-step/")) {
    const match = p.match(/\/application\/custom-step\/([^/?#]+)/);
    if (match?.[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        return findApplicantStepByKey(steps, decoded);
      } catch {
        return null;
      }
    }
  }

  for (const step of steps) {
    const route = routeForApplicantStep(step);
    const routePath = route.split("?")[0];
    if (p.startsWith(routePath) || p.includes(routePath)) return step;

    for (const marker of APPLICATION_ROUTE_STEP_MARKERS) {
      if (pathnameMatchesStepGroup(p, step, marker)) return step;
    }
  }

  return null;
}

export function stepIndexForApplicantStep(
  step: TenantOnboardingStep | null,
  steps: TenantOnboardingStep[]
): number {
  if (!step || !steps.length) return 1;
  const idx = steps.findIndex((s) => s.id === step.id || s.step_key === step.step_key);
  return idx >= 0 ? idx + 1 : 1;
}
