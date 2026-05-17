import type { OnboardingStepType } from "@/lib/onboarding/types";
import { withTenant } from "@/lib/tenant/with-tenant";

/** Maps configured step keys/types to legacy application routes during UI migration. */
export function routeForOnboardingStep(stepKey: string, stepType: OnboardingStepType): string {
  switch (stepKey) {
    case "resume_upload":
      return "/application/step-1-upload";
    case "professional_license":
      return "/application/step-2-license";
    case "skill_assessment":
      return "/application/step-3-skills";
    case "authorizations":
      return "/application/step-4-documents";
    case "references":
      return "/application/step-5-add-references";
    case "review_submit":
      return "/application/step-6-summary";
    default:
      break;
  }

  switch (stepType) {
    case "resume_upload":
    case "profile_information":
      return "/application/step-1-upload";
    case "professional_license":
      return "/application/step-2-license";
    case "skill_assessment":
      return "/application/step-3-skills";
    case "document_upload":
    case "authorizations":
      return "/application/step-4-documents";
    case "references":
      return "/application/step-5-add-references";
    case "review_submit":
      return "/application/step-6-summary";
    case "custom_question":
      return `/application/onboarding/${stepKey}`;
    default:
      return `/application/onboarding/${stepKey}`;
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
