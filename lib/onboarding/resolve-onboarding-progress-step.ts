import { isBackgroundCheckAuthorizationStep } from "@/lib/onboarding/authorizations-documents-step";
import { isUploadResumeStep } from "@/lib/onboarding/enforce-upload-resume-first";
import { workflowStepIdFromMetadata } from "@/lib/onboarding/firma-step-settings";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";

/** Published flows may rename Authorization / Background Check between these keys. */
const AUTHORIZATION_STEP_KEY_ALIASES = new Set([
  "custom_question",
  "authorization_background_check",
  "authorizations",
  "agreement_signature",
  "background_check",
]);

function preferEnabled(
  steps: TenantOnboardingStep[],
  predicate: (step: TenantOnboardingStep) => boolean
): TenantOnboardingStep | null {
  return steps.find((step) => predicate(step) && step.is_enabled) ?? steps.find(predicate) ?? null;
}

function isAuthorizationFamilyKey(stepKey: string): boolean {
  if (AUTHORIZATION_STEP_KEY_ALIASES.has(stepKey)) return true;
  const base = stepKey.replace(/_\d+$/, "");
  return AUTHORIZATION_STEP_KEY_ALIASES.has(base);
}

/**
 * Resolve a tenant onboarding step for progress updates.
 * Handles exact keys, authorization aliases, and resume_upload type fallback.
 */
export function resolveOnboardingProgressStep(
  config: TenantOnboardingConfig | null | undefined,
  input: { stepId?: string | null; stepKey?: string | null }
): TenantOnboardingStep | null {
  const steps = config?.steps ?? [];
  if (!steps.length) return null;

  const stepId = input.stepId?.trim() || "";
  if (stepId) {
    const byId = preferEnabled(steps, (step) => step.id === stepId);
    if (byId) return byId;
  }

  const stepKey = input.stepKey?.trim() || "";
  if (!stepKey) return null;

  const exact = preferEnabled(steps, (step) => step.step_key === stepKey);
  if (exact) return exact;

  const baseKey = stepKey.replace(/_\d+$/, "");
  if (baseKey !== stepKey) {
    const byBase = preferEnabled(steps, (step) => step.step_key === baseKey);
    if (byBase) return byBase;
  }

  const byPrefixed = preferEnabled(
    steps,
    (step) => step.step_key.startsWith(`${baseKey}_`) || step.step_key === baseKey
  );
  if (byPrefixed) return byPrefixed;

  if (isAuthorizationFamilyKey(stepKey)) {
    const authStep = preferEnabled(
      steps,
      (step) =>
        isBackgroundCheckAuthorizationStep(step) ||
        step.step_type === "authorizations" ||
        workflowStepIdFromMetadata(step.metadata) === "background-check" ||
        AUTHORIZATION_STEP_KEY_ALIASES.has(step.step_key) ||
        AUTHORIZATION_STEP_KEY_ALIASES.has(step.step_key.replace(/_\d+$/, ""))
    );
    if (authStep) return authStep;
  }

  if (stepKey === "resume_upload" || baseKey === "resume_upload") {
    return preferEnabled(steps, (step) => isUploadResumeStep(step));
  }

  return null;
}
