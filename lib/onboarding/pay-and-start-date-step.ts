/** Workflow library ids for recruiter “Pay and start date” confirmation steps. */
const PAY_AND_START_STEP_IDS = new Set([
  "pay-rate-hire-date",
  "pay-and-start-date",
  "pay_rate_hire_date",
  "pay_and_start_date",
]);

function normalizeLibraryId(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");
}

export function isPayAndStartDateWorkflowStep(input: {
  stepType?: string | null;
  stepKey?: string | null;
  snapshotStepId?: string | null;
  workflowStepId?: string | null;
}): boolean {
  const candidates = [
    input.workflowStepId,
    input.snapshotStepId,
    input.stepType,
    input.stepKey,
  ];
  return candidates.some((id) => PAY_AND_START_STEP_IDS.has(normalizeLibraryId(id)));
}