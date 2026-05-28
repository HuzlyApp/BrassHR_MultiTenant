import type { StepSettings } from "@/app/components/workflow-builder/types";
import { defaultSerializableSettings } from "@/lib/onboarding/workflow-builder-serialization";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import { onboardingTypeToWorkflowStepId } from "@/lib/onboarding/workflow-step-mapping";
import type { SerializableWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";

const NODE_VERTICAL_SPACING = 130;
const CANVAS_X = 120;

/** Server-safe: convert step drafts into a serializable workflow canvas (no React icons). */
export function stepDraftsToSerializableWorkflow(
  steps: OnboardingStepDraft[]
): SerializableWorkflowState {
  const enabled = steps
    .filter((s) => s.is_enabled)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const nodes = enabled.map((step, index) => {
    const workflowStepId =
      typeof step.metadata?.workflow_step_id === "string"
        ? step.metadata.workflow_step_id
        : onboardingTypeToWorkflowStepId(step.step_type);

    const settings =
      (step.metadata?.workflow_settings as StepSettings | undefined) ??
      defaultSerializableSettings();

    return {
      id: `step-${step.step_key}`,
      stepId: workflowStepId,
      label: step.title.trim() || step.step_key,
      description: step.description?.trim() || null,
      position: { x: CANVAS_X, y: 40 + index * NODE_VERTICAL_SPACING },
      day: index + 1,
      required: step.is_required,
      settings: { ...defaultSerializableSettings(), ...settings, required: step.is_required },
    };
  });

  const edges = nodes.slice(0, -1).map((node, i) => ({
    id: `e-${node.id}-${nodes[i + 1].id}`,
    source: node.id,
    target: nodes[i + 1].id,
  }));

  return { nodes, edges };
}
