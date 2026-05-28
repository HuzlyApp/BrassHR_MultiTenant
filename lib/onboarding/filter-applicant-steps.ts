import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import { isWorkerVisibleStep } from "@/lib/onboarding/workflow-settings";

export function filterApplicantVisibleSteps(
  steps: TenantOnboardingStep[]
): TenantOnboardingStep[] {
  return steps.filter((s) => s.is_enabled && isWorkerVisibleStep(s));
}

export function applyApplicantConfigFilters(
  config: TenantOnboardingConfig
): TenantOnboardingConfig {
  const visibleStepIds = new Set(
    filterApplicantVisibleSteps(config.steps).map((s) => s.id)
  );

  return {
    ...config,
    steps: config.steps
      .filter((s) => visibleStepIds.has(s.id))
      .map((s) => ({ ...s, is_enabled: true })),
    requiredDocuments: config.requiredDocuments.filter((d) =>
      visibleStepIds.has(d.onboarding_step_id)
    ),
    skillAssessments: config.skillAssessments.filter((a) =>
      visibleStepIds.has(a.onboarding_step_id)
    ),
  };
}
