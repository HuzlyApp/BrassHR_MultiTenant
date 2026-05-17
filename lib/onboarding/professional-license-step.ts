import type { TenantOnboardingConfig, TenantOnboardingStep, TenantRequiredDocument } from "@/lib/onboarding/types";
import { routeForOnboardingStep } from "@/lib/onboarding/step-routes";
import { withTenant } from "@/lib/tenant/with-tenant";

/** Enabled professional-license step for the current tenant config. */
export function findProfessionalLicenseStep(
  config: TenantOnboardingConfig | null | undefined
): TenantOnboardingStep | null {
  if (!config?.steps?.length) return null;
  const enabled = config.steps.filter((s) => s.is_enabled);
  return (
    enabled.find((s) => s.step_type === "professional_license") ??
    enabled.find((s) => s.step_key === "professional_license") ??
    null
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
  if (!config || !currentStep) return null;
  const enabled = config.steps
    .filter((s) => s.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);
  const idx = enabled.findIndex((s) => s.id === currentStep.id);
  const next = idx >= 0 ? enabled[idx + 1] : null;
  if (!next) return null;
  return withTenant(routeForOnboardingStep(next.step_key, next.step_type), tenantSlug);
}
