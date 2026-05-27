import type { Edge, Node } from "@xyflow/react";
import type { StepDefinition } from "@/app/components/workflow-builder/types";
import {
  DEFAULT_STEP_SETTINGS,
  type WorkflowNodeData,
} from "@/app/components/workflow-builder/types";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { onboardingTypeToWorkflowStepId } from "@/lib/onboarding/workflow-step-mapping";

const NODE_VERTICAL_SPACING = 130;
const CANVAS_X = 120;

function resolveStepDefinition(
  stepId: string,
  stepById: Map<string, StepDefinition>
): StepDefinition | null {
  return stepById.get(stepId) ?? stepById.get(onboardingTypeToWorkflowStepId("custom_question")) ?? null;
}

export function draftsToWorkflowNodes(
  drafts: OnboardingStepDraft[],
  stepById: Map<string, StepDefinition>
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const enabled = drafts
    .filter((s) => s.is_enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  const nodes: Node<WorkflowNodeData>[] = enabled.map((step, index) => {
    const workflowStepId =
      typeof step.metadata?.workflow_step_id === "string"
        ? step.metadata.workflow_step_id
        : onboardingTypeToWorkflowStepId(step.step_type);
    const def =
      resolveStepDefinition(workflowStepId, stepById) ??
      ({
        id: workflowStepId,
        label: step.title,
        icon: null,
      } as StepDefinition);

    const settings =
      (step.metadata?.workflow_settings as WorkflowNodeData["settings"] | undefined) ??
      DEFAULT_STEP_SETTINGS;

    return {
      id: `step-${step.step_key}`,
      type: "step",
      position: { x: CANVAS_X, y: 40 + index * NODE_VERTICAL_SPACING },
      data: {
        stepId: def.id,
        label: step.title,
        icon: def.icon,
        day: index + 1,
        required: step.is_required,
        settings: { ...DEFAULT_STEP_SETTINGS, ...settings, required: step.is_required },
      },
    };
  });

  const edges: Edge[] = nodes.slice(0, -1).map((node, i) => ({
    id: `e-${node.id}-${nodes[i + 1].id}`,
    source: node.id,
    target: nodes[i + 1].id,
    type: "smoothstep",
  }));

  return { nodes, edges };
}

export function hydrateWorkflowFromStorage(
  builderDraft: unknown,
  drafts: OnboardingStepDraft[],
  stepById: Map<string, StepDefinition>
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  if (isSerializableWorkflowState(builderDraft) && builderDraft.nodes.length > 0) {
    const nodes: Node<WorkflowNodeData>[] = builderDraft.nodes.map((n) => {
      const def = resolveStepDefinition(n.stepId, stepById);
      return {
        id: n.id,
        type: "step",
        position: n.position,
        data: {
          stepId: n.stepId,
          label: n.label,
          icon: def?.icon ?? null,
          day: n.day,
          required: n.required,
          settings: n.settings,
        },
      };
    });

    const edges: Edge[] = builderDraft.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
    }));

    return { nodes, edges };
  }

  return draftsToWorkflowNodes(drafts, stepById);
}

export type BuilderMeta = {
  flowName: string;
  publishStatus: "draft" | "published";
  builderDraft: SerializableWorkflowState | null;
  updatedAt: string | null;
  updatedBy: string | null;
};
