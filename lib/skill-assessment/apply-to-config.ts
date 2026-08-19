import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import type { SkillAssessmentApplicantSettings } from "@/lib/skill-assessment/types";

function isSkillAssessmentStep(step: { step_type: string; step_key: string }): boolean {
  return step.step_type === "skill_assessment" || step.step_key === "skill_assessment";
}

export function applyPublishedSkillAssessmentToConfig(
  config: TenantOnboardingConfig,
  settings: SkillAssessmentApplicantSettings
): TenantOnboardingConfig {
  if (settings.enabled) {
    return { ...config, skillAssessmentSettings: settings };
  }

  return {
    ...config,
    skillAssessmentSettings: settings,
    steps: config.steps.filter((step) => !isSkillAssessmentStep(step)),
    skillAssessments: [],
    candidateEngineOrder: config.candidateEngineOrder?.filter((step) => step.step_key !== "skill_assessment"),
  };
}
