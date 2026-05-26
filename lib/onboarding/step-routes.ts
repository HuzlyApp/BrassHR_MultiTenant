import type { OnboardingStepType } from "@/lib/onboarding/types";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";

export { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
import { withTenant } from "@/lib/tenant/with-tenant";

/** Maps configured step keys/types to applicant application routes. */
export function routeForOnboardingStep(stepKey: string, stepType: OnboardingStepType): string {
  switch (stepKey) {
    case "resume_upload":
      return APPLICATION_ROUTES.addResume;
    case "professional_license":
      return APPLICATION_ROUTES.professionalLicense;
    case "skill_assessment":
      return APPLICATION_ROUTES.skillsIntro;
    case "authorizations":
      return APPLICATION_ROUTES.authorizationsDocuments;
    case "references":
      return APPLICATION_ROUTES.addReferences;
    case "review_submit":
      return APPLICATION_ROUTES.applicationSummary;
    default:
      break;
  }

  switch (stepType) {
    case "resume_upload":
    case "profile_information":
      return APPLICATION_ROUTES.addResume;
    case "professional_license":
      return APPLICATION_ROUTES.professionalLicense;
    case "skill_assessment":
      return APPLICATION_ROUTES.skillsIntro;
    case "document_upload":
    case "authorizations":
      return APPLICATION_ROUTES.authorizationsDocuments;
    case "references":
      return APPLICATION_ROUTES.addReferences;
    case "review_submit":
      return APPLICATION_ROUTES.applicationSummary;
    case "custom_question":
      return APPLICATION_ROUTES.customStep(stepKey);
    default:
      return APPLICATION_ROUTES.customStep(stepKey);
  }
}

export { stepIndexFromPathname } from "@/lib/onboarding/step-index-from-pathname";

export function tenantAwareOnboardingRoute(
  stepKey: string,
  stepType: OnboardingStepType,
  tenant?: string | null
): string {
  return withTenant(routeForOnboardingStep(stepKey, stepType), tenant);
}
