import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export const REFERENCE_VERIFICATION_LIBRARY_ID = "reference-verification";

/**
 * Advisory internal steps: staff record a decision, but whatever it is (or if it is never made)
 * the step never blocks the candidate or later Hire Journey stages.
 */
export const ALWAYS_OPTIONAL_STEP_LIBRARY_IDS: ReadonlySet<string> = new Set([
  REFERENCE_VERIFICATION_LIBRARY_ID,
  "internal-select",
]);

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replaceAll("_", "-");
}

/** Assigned step records / mapped steps carry the library id as `step_type`. */
export function isReferenceVerificationStep(step: { stepType?: string | null }): boolean {
  return normalize(step.stepType) === REFERENCE_VERIFICATION_LIBRARY_ID;
}

/** Published tenant steps store the library id in metadata; `step_type` is generic (e.g. "references"). */
export function isReferenceVerificationTenantStep(step: Pick<TenantOnboardingStep, "metadata">): boolean {
  return normalize(step.metadata?.workflow_step_id) === REFERENCE_VERIFICATION_LIBRARY_ID;
}

export function isAlwaysOptionalStep(step: { stepType?: string | null }): boolean {
  return ALWAYS_OPTIONAL_STEP_LIBRARY_IDS.has(normalize(step.stepType));
}

export function isTenantStepBlocking(step: Pick<TenantOnboardingStep, "is_required" | "metadata">): boolean {
  return (
    step.is_required !== false &&
    !ALWAYS_OPTIONAL_STEP_LIBRARY_IDS.has(normalize(step.metadata?.workflow_step_id))
  );
}
