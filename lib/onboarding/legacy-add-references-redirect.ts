import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { readStepKeyFromSearch } from "@/lib/onboarding/find-applicant-step";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";
import { firstOnboardingStepRoute } from "@/lib/onboarding/tenant-step-navigation";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

const REFERENCE_LIBRARY_IDS = new Set(["references-collection", "reference-verification"]);

export function isReferencesWorkflowStep(step: TenantOnboardingStep): boolean {
  if (step.step_type === "references") return true;
  const libraryId = step.metadata?.workflow_step_id;
  return typeof libraryId === "string" && REFERENCE_LIBRARY_IDS.has(libraryId);
}

/** Query params preserved when redirecting between applicant onboarding screens. */
export function mergeOnboardingQuery(basePath: string, currentSearch: string): string {
  const current = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  const [path, existingQuery] = basePath.split("?");
  const merged = new URLSearchParams(existingQuery ?? "");

  for (const key of ["preview", "applicationId", "tenant"]) {
    const value = current.get(key);
    if (value && !merged.has(key)) merged.set(key, value);
  }

  const query = merged.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * When the applicant lands on /application/add-references, return the workflow step route
 * they should see instead — or null when references is a configured step for this URL.
 */
export function resolveLegacyAddReferencesTarget(
  config: TenantOnboardingConfig | null | undefined,
  enabledSteps: TenantOnboardingStep[],
  search: string,
  tenantSlug?: string | null
): string | null {
  if (!enabledSteps.length) return null;

  const stepKey = readStepKeyFromSearch(search);
  const keyedStep = stepKey
    ? enabledSteps.find((step) => step.step_key === stepKey) ?? null
    : null;

  if (keyedStep && isReferencesWorkflowStep(keyedStep)) {
    return null;
  }

  if (!stepKey) {
    const referencesStep = enabledSteps.find(isReferencesWorkflowStep);
    if (referencesStep) return null;
  }

  const fallbackStep = keyedStep ?? enabledSteps[0];
  const base =
    keyedStep != null
      ? routeForApplicantStep(fallbackStep, tenantSlug)
      : firstOnboardingStepRoute(config, tenantSlug);

  return mergeOnboardingQuery(base, search);
}

/** Server-side redirect target for legacy add-references bookmarks. */
export function buildLegacyAddReferencesRedirectUrl(
  origin: string,
  searchParams: URLSearchParams
): string {
  const destination = new URL("/application/onboarding", origin);
  for (const key of ["tenant", "applicationId", "stepKey", "preview"]) {
    const value = searchParams.get(key)?.trim();
    if (value) destination.searchParams.set(key, value);
  }
  return destination.pathname + destination.search;
}

export { APPLICATION_ROUTES };
