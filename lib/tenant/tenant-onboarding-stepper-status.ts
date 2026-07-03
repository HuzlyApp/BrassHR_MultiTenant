/** Visual state for each of the 4 tenant onboarding macro steps. */
export type TenantStepIndicatorState =
  | "not_started"
  | "current"
  | "completed"
  | "skipped";

export type TenantOnboardingFlowStep =
  | "goals"
  | "business"
  | "company_logo"
  | "branding"
  | "domain"
  | "onboarding"
  | "preview"
  | "admin"
  | "done";

export type TenantOnboardingSkippedSteps = {
  goals: boolean;
  business: boolean;
  branding: boolean;
};

export function tenantOnboardingMacroStepIndex(step: TenantOnboardingFlowStep): number {
  switch (step) {
    case "goals":
      return 0;
    case "business":
      return 1;
    case "company_logo":
    case "branding":
      return 2;
    case "domain":
    case "onboarding":
    case "preview":
    case "admin":
      return 3;
    case "done":
      return 4;
    default:
      return 0;
  }
}

const MACRO_STEP_COUNT = 4;

function wasMacroStepSkipped(
  macroIndex: number,
  skipped: TenantOnboardingSkippedSteps
): boolean {
  if (macroIndex === 0) return skipped.goals;
  if (macroIndex === 1) return skipped.business;
  if (macroIndex === 2) return skipped.branding;
  return false;
}

/**
 * Stepper icons: gold check when a past step was completed (not skipped);
 * yellow warning only when the user chose Skip for Now on that macro step.
 */
export function deriveTenantOnboardingStepStates(params: {
  step: TenantOnboardingFlowStep;
  skippedSteps: TenantOnboardingSkippedSteps;
}): TenantStepIndicatorState[] {
  const activeMacro = tenantOnboardingMacroStepIndex(params.step);

  return Array.from({ length: MACRO_STEP_COUNT }, (_, macroIndex) => {
    if (activeMacro < MACRO_STEP_COUNT && macroIndex > activeMacro) {
      return "not_started";
    }
    if (activeMacro < MACRO_STEP_COUNT && macroIndex === activeMacro) {
      return "current";
    }

    if (wasMacroStepSkipped(macroIndex, params.skippedSteps)) {
      return "skipped";
    }

    return "completed";
  });
}
