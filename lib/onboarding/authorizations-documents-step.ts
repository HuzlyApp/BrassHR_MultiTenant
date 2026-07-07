import {
  stepUsesFirmaSigning,
  workflowStepIdFromMetadata,
} from "@/lib/onboarding/firma-step-settings";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export function isBackgroundCheckAuthorizationStep(
  step: Pick<TenantOnboardingStep, "step_key" | "step_type" | "metadata"> | null | undefined
): boolean {
  if (!step) return false;
  if (step.step_key === "authorization_background_check") return true;
  return (
    step.step_type === "custom_question" &&
    workflowStepIdFromMetadata(step.metadata) === "background-check"
  );
}

export function stepRequiresApplicantAgreement(
  step: Pick<TenantOnboardingStep, "is_required"> | null | undefined
): boolean {
  return step?.is_required !== false;
}

export function stepRequiresIdentityDocuments(
  step: Pick<TenantOnboardingStep, "step_key" | "step_type" | "metadata" | "is_required"> | null | undefined
): boolean {
  if (!step || step.is_required === false) return false;
  return isBackgroundCheckAuthorizationStep(step);
}

export function shouldShowFirmaAgreementPanel(
  step: Pick<TenantOnboardingStep, "metadata"> | null | undefined
): boolean {
  return Boolean(step && stepUsesFirmaSigning(step));
}

export type AuthorizationsSaveState = {
  step: Pick<TenantOnboardingStep, "step_key" | "step_type" | "metadata" | "is_required"> | null;
  agreed: boolean;
  agreementSigned: boolean;
  identityDocsComplete: boolean;
};

export function isAuthorizationsSaveBlocked({
  step,
  agreed,
  agreementSigned,
  identityDocsComplete,
}: AuthorizationsSaveState): boolean {
  if (!step) return true;

  if (stepRequiresApplicantAgreement(step) && !agreed) return true;
  if (shouldShowFirmaAgreementPanel(step) && stepRequiresApplicantAgreement(step) && !agreementSigned) {
    return true;
  }
  if (stepRequiresIdentityDocuments(step) && !identityDocsComplete) return true;
  return false;
}
