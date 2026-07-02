import type { OnboardingStepStatus } from "@/lib/onboarding/types";

/** Visual / routing state for applicant onboarding step indicators. */
export type StepIndicatorState =
  | "not_started"
  | "current"
  | "completed"
  | "skipped"
  | "incomplete"
  | "required_missing";

export function deriveStepIndicatorState(params: {
  dbStatus: OnboardingStepStatus | string | null | undefined;
  stepNumber: number;
  currentStepNumber: number;
  isRequired: boolean;
}): StepIndicatorState {
  const { dbStatus, stepNumber, currentStepNumber, isRequired } = params;
  const status = dbStatus ?? "pending";

  if (stepNumber === currentStepNumber) return "current";
  if (status === "completed") return "completed";
  if (status === "skipped") {
    return isRequired ? "required_missing" : "skipped";
  }
  if (status === "in_progress" || status === "failed") {
    return "incomplete";
  }
  if (stepNumber < currentStepNumber) {
    return isRequired ? "required_missing" : "incomplete";
  }
  return "not_started";
}

/** Whether the applicant may navigate to this step in the stepper. */
export function isStepIndicatorAccessible(
  state: StepIndicatorState,
  stepNumber: number,
  maxAllowedStepNumber: number
): boolean {
  if (stepNumber > maxAllowedStepNumber) return false;
  return (
    state === "completed" ||
    state === "skipped" ||
    state === "required_missing" ||
    state === "current" ||
    state === "incomplete"
  );
}

/** Furthest step index (1-based) reached for progress connector width. */
export function furthestProgressStepIndex(
  states: StepIndicatorState[],
  currentStepNumber: number
): number {
  let max = 1;
  states.forEach((state, index) => {
    const stepNumber = index + 1;
    if (
      state === "completed" ||
      state === "skipped" ||
      state === "required_missing" ||
      state === "current" ||
      state === "incomplete"
    ) {
      max = Math.max(max, stepNumber);
    }
  });
  return Math.max(max, currentStepNumber);
}
