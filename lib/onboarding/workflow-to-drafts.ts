import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { reindexStepSortOrders } from "@/lib/onboarding/default-onboarding-steps";
import { createStepDraftForType } from "@/lib/onboarding/create-step-draft";
import {
  orderedNodeIds,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";

function uniqueStepKey(stepType: string, existingKeys: Set<string>, preferred: string): string {
  if (!existingKeys.has(preferred)) return preferred;
  let n = 2;
  while (existingKeys.has(`${preferred}_${n}`)) n += 1;
  return `${preferred}_${n}`;
}

/**
 * Converts a saved workflow canvas into tenant onboarding step drafts for persistence.
 */
export function workflowStateToStepDrafts(
  state: SerializableWorkflowState,
  existingSteps: OnboardingStepDraft[] = []
): OnboardingStepDraft[] {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const order = orderedNodeIds(state.nodes, state.edges);
  const existingKeys = new Set(existingSteps.map((s) => s.step_key));
  const drafts: OnboardingStepDraft[] = [];

  order.forEach((nodeId, index) => {
    const node = byId.get(nodeId);
    if (!node) return;

    const stepType = workflowStepIdToOnboardingType(node.stepId);

    const prior = existingSteps.find((s) => s.metadata?.workflow_node_id === node.id);

    const base = prior
      ? { ...prior }
      : createStepDraftForType(stepType, [...existingSteps, ...drafts]);

    const stepKey = prior?.step_key ?? uniqueStepKey(stepType, existingKeys, stepType);
    existingKeys.add(stepKey);

    drafts.push({
      ...base,
      step_key: stepKey,
      title: node.label.trim() || base.title,
      step_type: stepType,
      sort_order: (index + 1) * 10,
      is_required: node.required,
      is_enabled: true,
      metadata: {
        ...base.metadata,
        workflow_step_id: node.stepId,
        workflow_node_id: node.id,
        workflow_settings: node.settings,
      },
    });
  });

  if (!drafts.length && existingSteps.length) {
    return reindexStepSortOrders(existingSteps);
  }

  const hasReview = drafts.some((s) => s.step_type === "review_submit");
  if (!hasReview) {
    drafts.push(createStepDraftForType("review_submit", drafts));
  }

  return reindexStepSortOrders(drafts);
}
