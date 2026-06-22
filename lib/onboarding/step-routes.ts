export { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";
export {
  routeForOnboardingStep,
  routeForApplicantStep,
  WORKFLOW_STEP_APPLICANT_ROUTE,
} from "@/lib/onboarding/resolve-applicant-step-route";
export { stepIndexFromPathname } from "@/lib/onboarding/step-index-from-pathname";
export { withTenant } from "@/lib/tenant/with-tenant";

import type { OnboardingStepType } from "@/lib/onboarding/types";
import { routeForApplicantStep } from "@/lib/onboarding/resolve-applicant-step-route";

export function tenantAwareOnboardingRoute(
  stepKey: string,
  stepType: OnboardingStepType,
  tenant?: string | null
): string {
  return routeForApplicantStep({ step_key: stepKey, step_type: stepType, metadata: {} }, tenant);
}
