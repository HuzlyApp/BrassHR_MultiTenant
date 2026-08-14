import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import { projectCandidateOnboardingConfig } from "@/lib/onboarding/candidate-onboarding-projection";
import { isWorkerVisibleStep } from "@/lib/onboarding/workflow-settings";
import {
  applyApplicantPhaseToConfig,
  type ApplicantLifecyclePhase,
} from "@/lib/onboarding/workflow-phase";

export function filterApplicantVisibleSteps(
  steps: TenantOnboardingStep[]
): TenantOnboardingStep[] {
  return steps.filter((s) => s.is_enabled && isWorkerVisibleStep(s));
}

export function applyApplicantConfigFilters(
  config: TenantOnboardingConfig,
  options?: { activePhase?: ApplicantLifecyclePhase | null }
): TenantOnboardingConfig {
  const phased = options?.activePhase
    ? applyApplicantPhaseToConfig(config, options.activePhase)
    : config;
  return projectCandidateOnboardingConfig(phased);
}
