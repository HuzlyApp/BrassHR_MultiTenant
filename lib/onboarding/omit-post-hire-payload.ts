import type { CandidateWorkflowPhaseView } from "@/lib/onboarding/candidate-workflow-phase-view";
import { sanitizeTagsForClient } from "@/lib/onboarding/assigned-workflow-steps";

export function omitPostHireFromClientPayload(
  view: CandidateWorkflowPhaseView
): CandidateWorkflowPhaseView {
  if (view.postHireVisible) return view;
  return {
    ...view,
    postHireVisible: false,
    postHire: null,
    currentStage: view.currentStage === "post_hire" ? "hired" : view.currentStage,
    currentWorkflowName:
      view.currentStage === "post_hire" ? view.preHire.assignment?.workflowName ?? null : view.currentWorkflowName,
    currentStepTitle:
      view.currentStage === "post_hire" ? view.preHire.assignment?.currentStepTitle ?? null : view.currentStepTitle,
    tags: sanitizeTagsForClient(view.tags, false),
  };
}

export function clientPayloadContainsPostHireData(payload: unknown): boolean {
  if (payload == null || typeof payload !== "object") return false;
  const json = JSON.stringify(payload);
  if (/"postHire"\s*:\s*\{/.test(json)) return true;
  if (/"phase"\s*:\s*"post_hire"/.test(json)) return true;
  if (/Post-Hire workflow/i.test(json)) return true;
  return false;
}
