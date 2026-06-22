import type { TenantOnboardingConfig, TenantOnboardingStep, TenantRequiredDocument } from "@/lib/onboarding/types";
import { findApplicantStepByKey } from "@/lib/onboarding/find-applicant-step";
import { adjacentStepRoute, getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

/** Resolve the workflow step for a dedicated applicant page (uses ?stepKey= when present). */
export function resolveApplicantPageStep(
  config: TenantOnboardingConfig | null | undefined,
  stepKeyFromUrl: string | null,
  fallback: (steps: TenantOnboardingStep[]) => TenantOnboardingStep | null
): TenantOnboardingStep | null {
  const enabled = getEnabledTenantSteps(config);
  if (!enabled.length) return null;

  if (stepKeyFromUrl) {
    const byKey = findApplicantStepByKey(enabled, stepKeyFromUrl);
    if (byKey) return byKey;
  }

  return fallback(enabled);
}

export function findProfessionalLicenseStep(
  config: TenantOnboardingConfig | null | undefined,
  stepKey?: string | null
): TenantOnboardingStep | null {
  return resolveApplicantPageStep(config, stepKey ?? null, (enabled) => {
    if (stepKey) return findApplicantStepByKey(enabled, stepKey);
    return (
      enabled.find((s) => s.step_type === "professional_license") ??
      enabled.find((s) => s.step_type === "document_upload") ??
      enabled.find((s) => s.step_key === "professional_license") ??
      null
    );
  });
}

export function findReferencesStep(
  config: TenantOnboardingConfig | null | undefined,
  stepKey?: string | null
): TenantOnboardingStep | null {
  return resolveApplicantPageStep(config, stepKey ?? null, (enabled) =>
    enabled.find((s) => s.step_type === "references") ?? null
  );
}

export function findResumeStep(
  config: TenantOnboardingConfig | null | undefined,
  stepKey?: string | null
): TenantOnboardingStep | null {
  return resolveApplicantPageStep(config, stepKey ?? null, (enabled) =>
    enabled.find(
      (s) => s.step_type === "resume_upload" || s.step_type === "profile_information"
    ) ?? null
  );
}

export function requiredDocumentsForStep(
  config: TenantOnboardingConfig | null | undefined,
  stepId: string
): TenantRequiredDocument[] {
  if (!config) return [];
  return config.requiredDocuments
    .filter((d) => d.onboarding_step_id === stepId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function nextStepRouteAfter(
  config: TenantOnboardingConfig | null | undefined,
  currentStep: TenantOnboardingStep | null,
  tenantSlug?: string | null
): string | null {
  return adjacentStepRoute(config, currentStep, 1, tenantSlug);
}
