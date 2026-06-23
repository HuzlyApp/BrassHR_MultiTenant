import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { stepUsesFirmaSigning } from "@/lib/onboarding/firma-step-settings";
import type { OnboardingStepType, TenantOnboardingStep } from "@/lib/onboarding/types";
import { withTenant } from "@/lib/tenant/with-tenant";

/** Builder library step id → primary applicant route. */
export const WORKFLOW_STEP_APPLICANT_ROUTE: Record<string, string> = {
  "resume-basic-profile": APPLICATION_ROUTES.addResume,
  "parameterized-job-application": APPLICATION_ROUTES.addResume,
  "references-collection": APPLICATION_ROUTES.addReferences,
  "reference-verification": APPLICATION_ROUTES.addReferences,
  "skill-qualification-assessment": APPLICATION_ROUTES.skillsIntro,
  "training-modules-quiz": APPLICATION_ROUTES.skillsIntro,
  "document-upload": APPLICATION_ROUTES.professionalLicense,
  "credential-license-verification": APPLICATION_ROUTES.professionalLicense,
  "certification-upload": APPLICATION_ROUTES.professionalLicense,
  "welcome-packet-esign": APPLICATION_ROUTES.authorizationsDocuments,
  "i9-right-to-work-verification": APPLICATION_ROUTES.authorizationsDocuments,
  "tax-forms": APPLICATION_ROUTES.authorizationsDocuments,
  "employee-agreement": APPLICATION_ROUTES.authorizationsDocuments,
  "policy-acknowledgment": APPLICATION_ROUTES.authorizationsDocuments,
  "equipment-badge-acknowledgment": APPLICATION_ROUTES.authorizationsDocuments,
  "ssn-identity-verification": APPLICATION_ROUTES.identityVerification,
  "background-check": APPLICATION_ROUTES.customStep("background_check"),
};

const CANONICAL_STEP_KEY_ROUTES: Record<string, string> = {
  resume_upload: APPLICATION_ROUTES.addResume,
  professional_license: APPLICATION_ROUTES.professionalLicense,
  skill_assessment: APPLICATION_ROUTES.skillsIntro,
  authorizations: APPLICATION_ROUTES.authorizationsDocuments,
  references: APPLICATION_ROUTES.addReferences,
  review_submit: APPLICATION_ROUTES.applicationSummary,
};

const STEP_TYPE_ROUTES: Record<OnboardingStepType, string> = {
  resume_upload: APPLICATION_ROUTES.addResume,
  profile_information: APPLICATION_ROUTES.addResume,
  professional_license: APPLICATION_ROUTES.professionalLicense,
  skill_assessment: APPLICATION_ROUTES.skillsIntro,
  document_upload: APPLICATION_ROUTES.professionalLicense,
  authorizations: APPLICATION_ROUTES.authorizationsDocuments,
  references: APPLICATION_ROUTES.addReferences,
  review_submit: APPLICATION_ROUTES.applicationSummary,
  custom_question: APPLICATION_ROUTES.customStep(""),
};

function workflowStepId(step: Pick<TenantOnboardingStep, "metadata">): string | null {
  const id = step.metadata?.workflow_step_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function isDuplicateStepKey(stepKey: string, stepType: OnboardingStepType): boolean {
  if (stepKey === stepType) return false;
  if (CANONICAL_STEP_KEY_ROUTES[stepKey]) return false;
  return /_\d+$/.test(stepKey) || stepKey.includes("_");
}

function baseRouteForStep(step: TenantOnboardingStep): string {
  if (stepUsesFirmaSigning(step)) {
    return APPLICATION_ROUTES.firmaSign;
  }

  if (step.step_type === "review_submit" || step.step_key === "review_submit") {
    return APPLICATION_ROUTES.applicationSummary;
  }

  const libraryId = workflowStepId(step);
  if (libraryId && WORKFLOW_STEP_APPLICANT_ROUTE[libraryId]) {
    return WORKFLOW_STEP_APPLICANT_ROUTE[libraryId];
  }

  if (CANONICAL_STEP_KEY_ROUTES[step.step_key]) {
    return CANONICAL_STEP_KEY_ROUTES[step.step_key];
  }

  if (!isDuplicateStepKey(step.step_key, step.step_type) && STEP_TYPE_ROUTES[step.step_type]) {
    const typeRoute = STEP_TYPE_ROUTES[step.step_type];
    if (step.step_type !== "custom_question") return typeRoute;
  }

  return APPLICATION_ROUTES.customStep(step.step_key);
}

export function dedicatedRouteForWorkflowStep(step: TenantOnboardingStep): string | null {
  if (stepUsesFirmaSigning(step)) {
    return APPLICATION_ROUTES.firmaSign;
  }

  const libraryId = workflowStepId(step);
  if (libraryId && WORKFLOW_STEP_APPLICANT_ROUTE[libraryId]) {
    return WORKFLOW_STEP_APPLICANT_ROUTE[libraryId];
  }
  const base = baseRouteForStep(step);
  if (base.includes("/application/custom-step/")) return null;
  return base;
}

/** Applicant route for a configured workflow step, including stepKey for disambiguation. */
export function routeForApplicantStep(
  step: Pick<TenantOnboardingStep, "step_key" | "step_type" | "metadata">,
  tenantSlug?: string | null
): string {
  const base = baseRouteForStep(step as TenantOnboardingStep);
  const sep = base.includes("?") ? "&" : "?";
  const withKey = `${base}${sep}stepKey=${encodeURIComponent(step.step_key)}`;
  return withTenant(withKey, tenantSlug);
}

/** Legacy helper — prefer routeForApplicantStep with full step object. */
export function routeForOnboardingStep(stepKey: string, stepType: OnboardingStepType): string {
  return baseRouteForStep({
    step_key: stepKey,
    step_type: stepType,
    metadata: {},
  } as TenantOnboardingStep);
}
