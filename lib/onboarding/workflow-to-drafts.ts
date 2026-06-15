import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { reindexStepSortOrders } from "@/lib/onboarding/default-onboarding-steps";
import { createStepDraftForType } from "@/lib/onboarding/create-step-draft";
import {
  orderedNodeIds,
  type SerializableWorkflowNode,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { dayFromDatePriority } from "@/lib/onboarding/normalize-workflow-settings";
import type { OnboardingStepType } from "@/lib/onboarding/types";
import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";

function uniqueStepKey(stepType: string, existingKeys: Set<string>, preferred: string): string {
  if (!existingKeys.has(preferred)) return preferred;
  let n = 2;
  while (existingKeys.has(`${preferred}_${n}`)) n += 1;
  return `${preferred}_${n}`;
}

/** Canvas "custom-step" nodes labeled Summary are the review/submit step, not custom questions. */
function isSummaryWorkflowNode(node: SerializableWorkflowNode): boolean {
  const label = node.label?.trim().toLowerCase() ?? "";
  const desc = node.description?.trim().toLowerCase() ?? "";
  return (
    label === "summary" ||
    label.includes("review and submit") ||
    desc.includes("review and submit") ||
    desc.includes("submit application")
  );
}

function resolveStepTypeForWorkflowNode(
  node: SerializableWorkflowNode,
  prior: OnboardingStepDraft | undefined
): OnboardingStepType {
  if (prior?.step_type === "review_submit") return "review_submit";
  const mapped = workflowStepIdToOnboardingType(node.stepId);
  if (mapped === "custom_question" && isSummaryWorkflowNode(node)) {
    return "review_submit";
  }
  return mapped;
}

function preferredStepKey(
  stepType: OnboardingStepType,
  existingKeys: Set<string>,
  prior: OnboardingStepDraft | undefined
): string {
  if (prior?.step_key) return prior.step_key;
  if (stepType === "review_submit" && !existingKeys.has("review_submit")) {
    return "review_submit";
  }
  return uniqueStepKey(stepType, existingKeys, stepType);
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

    const prior = existingSteps.find((s) => s.metadata?.workflow_node_id === node.id);

    const stepType = resolveStepTypeForWorkflowNode(node, prior);

    const base = prior
      ? { ...prior }
      : createStepDraftForType(stepType, [...existingSteps, ...drafts]);

    const stepKey = preferredStepKey(stepType, existingKeys, prior);
    existingKeys.add(stepKey);

    drafts.push({
      ...base,
      step_key: stepKey,
      title: node.label.trim() || base.title,
      description:
        typeof node.description === "string" && node.description.trim()
          ? node.description.trim()
          : base.description,
      step_type: stepType,
      sort_order: (index + 1) * 10,
      is_required: node.required,
      is_enabled: true,
      metadata: {
        ...base.metadata,
        workflow_step_id: node.stepId,
        workflow_node_id: node.id,
        workflow_day: node.day ?? dayFromDatePriority(node.settings.datePriority),
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
