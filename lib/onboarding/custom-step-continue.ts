/**
 * Continue on /application/custom-step/:key must persist + goNext.
 *
 * Library steps such as OIG / Exclusion Check are `custom_question` with a
 * partner provider and no dedicated applicant route. The old Continue handler
 * pushed the same custom-step URL and never marked the step completed, so the
 * applicant stayed on the screen.
 */
export function resolveCustomStepContinue(input: {
  formVisible: boolean;
  required: boolean;
  answer: string;
}): { action: "require-answer" } | { action: "complete"; response: string } {
  if (input.formVisible && input.required && !input.answer.trim()) {
    return { action: "require-answer" };
  }
  return {
    action: "complete",
    response: input.formVisible ? input.answer.trim() : "",
  };
}
