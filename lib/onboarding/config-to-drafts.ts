import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";

export function mapConfigToDrafts(config: TenantOnboardingConfig): OnboardingStepDraft[] {
  return config.steps
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((step) => ({
      step_key: step.step_key,
      title: step.title,
      description: step.description ?? "",
      step_type: step.step_type,
      sort_order: step.sort_order,
      is_required: step.is_required,
      is_enabled: step.is_enabled,
      metadata: step.metadata ?? {},
      required_documents: config.requiredDocuments
        .filter((d) => d.onboarding_step_id === step.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => ({
          title: d.title,
          description: d.description ?? "",
          is_required: d.is_required,
          sort_order: d.sort_order,
        })),
    }));
}

/** @deprecated Use mapConfigToDrafts */
export const configToDrafts = mapConfigToDrafts;
