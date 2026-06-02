/**
 * Supported conditionalLogic patterns from the workflow builder.
 * Arbitrary expression trees are not evaluated — only documented prefixes/phrases.
 */
export type ConditionalLogicEvaluation = {
  raw: string;
  hideFromApplicant: boolean;
  pauseFlowOnFail: boolean;
};

export function evaluateConditionalLogic(
  logic: string | null | undefined
): ConditionalLogicEvaluation {
  const raw = (logic ?? "").trim();
  const lower = raw.toLowerCase();

  const hideFromApplicant =
    lower.startsWith("admin only") || lower.startsWith("hide from applicant");

  const pauseFlowOnFail =
    (lower.includes("pause") && lower.includes("fail")) ||
    lower.includes("if result = fail") ||
    lower.includes("if result=fail");

  return { raw, hideFromApplicant, pauseFlowOnFail };
}
