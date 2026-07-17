import {
  stepUsesFirmaSigning,
  workflowStepIdFromMetadata,
  getFirmaRecruiterTemplateId,
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

/**
 * Authorization / Background Check should host Firma signing. If this step has no
 * template attached yet, inherit settings from a sibling Agreement Signature step
 * (including soft-disabled retired defaults).
 */
export function resolveAuthorizationStepWithFirma(
  activeStep: TenantOnboardingStep | null | undefined,
  allSteps: TenantOnboardingStep[] | null | undefined
): TenantOnboardingStep | null {
  if (!activeStep) return null;

  if (getFirmaRecruiterTemplateId(activeStep)) return activeStep;
  if (!isBackgroundCheckAuthorizationStep(activeStep)) return activeStep;

  const donor =
    (allSteps ?? []).find(
      (step) =>
        step.step_key === "agreement_signature" && Boolean(getFirmaRecruiterTemplateId(step))
    ) ??
    (allSteps ?? []).find(
      (step) =>
        workflowStepIdFromMetadata(step.metadata) === "employee-agreement" &&
        Boolean(getFirmaRecruiterTemplateId(step))
    ) ??
    (allSteps ?? []).find(
      (step) =>
        step.id !== activeStep.id &&
        Boolean(getFirmaRecruiterTemplateId(step)) &&
        (step.step_type === "authorizations" ||
          workflowStepIdFromMetadata(step.metadata) === "welcome-packet-esign")
    );

  if (!donor) return activeStep;

  const donorSettings = donor.metadata?.workflow_settings;
  const settings =
    donorSettings && typeof donorSettings === "object" && !Array.isArray(donorSettings)
      ? { ...(donorSettings as Record<string, unknown>) }
      : {};

  return {
    ...activeStep,
    metadata: {
      ...activeStep.metadata,
      workflow_settings: {
        ...((activeStep.metadata?.workflow_settings &&
        typeof activeStep.metadata.workflow_settings === "object" &&
        !Array.isArray(activeStep.metadata.workflow_settings)
          ? activeStep.metadata.workflow_settings
          : {}) as Record<string, unknown>),
        ...settings,
      },
      firma_inherited_from_step_key: donor.step_key,
    },
  };
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
