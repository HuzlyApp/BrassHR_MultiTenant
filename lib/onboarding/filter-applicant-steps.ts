import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import { projectCandidateOnboardingConfig } from "@/lib/onboarding/candidate-onboarding-projection";
import { isWorkerVisibleStep } from "@/lib/onboarding/workflow-settings";
import {
  applyApplicantPhaseToConfig,
  type ApplicantLifecyclePhase,
} from "@/lib/onboarding/workflow-phase";
import { applyPublishedSkillAssessmentToConfig } from "@/lib/skill-assessment/apply-to-config";

export function filterApplicantVisibleSteps(
  steps: TenantOnboardingStep[]
): TenantOnboardingStep[] {
  return steps.filter((s) => s.is_enabled && isWorkerVisibleStep(s));
}

export function applyApplicantConfigFilters(
  config: TenantOnboardingConfig,
  options?: { activePhase?: ApplicantLifecyclePhase | null }
): TenantOnboardingConfig {
  const gated = config.skillAssessmentSettings
    ? applyPublishedSkillAssessmentToConfig(config, config.skillAssessmentSettings)
    : config;
  const phased = options?.activePhase
    ? applyApplicantPhaseToConfig(gated, options.activePhase)
    : gated;
  return projectCandidateOnboardingConfig(phased);
}
