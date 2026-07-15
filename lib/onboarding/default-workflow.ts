import type { StepCategory } from "@/app/components/workflow-builder";
import type { Edge, Node } from "@xyflow/react";
import type { WorkflowNodeData } from "@/app/components/workflow-builder";
import { buildWorkflowStepLookup } from "@/app/components/onboarding/workflow-step-library";
import {
  createDefaultOnboardingStepDrafts,
  type OnboardingStepDraft,
} from "@/lib/onboarding/default-onboarding-steps";
import { mapConfigToDrafts } from "@/lib/onboarding/config-to-drafts";
import { draftsToWorkflowNodes } from "@/lib/onboarding/drafts-to-workflow";
import { stepDraftsToSerializableWorkflow } from "@/lib/onboarding/step-drafts-to-workflow-state";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";

export const DEFAULT_WORKFLOW_STEP_LABELS = [
  "Upload Resume",
  "Professional License",
  "Skill Assessment",
  "Authorization / Background Check",
  "Add Reference",
  "Final Review / Completion",
] as const;

export function createDefaultWorkflowState(): SerializableWorkflowState {
  return stepDraftsToSerializableWorkflow(createDefaultOnboardingStepDrafts());
}

export function resolveBuilderStepDrafts(
  config: TenantOnboardingConfig | null | undefined,
  options?: { workerFacing?: boolean }
): { drafts: OnboardingStepDraft[]; fromDefaults: boolean } {
  const workerFacing = options?.workerFacing ?? false;

  if (!config?.steps?.length) {
    return { drafts: createDefaultOnboardingStepDrafts(), fromDefaults: true };
  }

  const drafts = mapConfigToDrafts(config);
  if (workerFacing) {
    return {
      drafts: drafts.filter((step) => step.is_enabled !== false),
      fromDefaults: false,
    };
  }
  return { drafts, fromDefaults: false };
}

export function tenantHasPublishedCustomWorkflow(
  config: TenantOnboardingConfig | null | undefined,
  builderDraft: unknown
): boolean {
  if (isSerializableWorkflowState(builderDraft) && builderDraft.nodes.length > 0) {
    return true;
  }
  return Boolean(config?.steps?.some((step) => step.is_enabled));
}

export function hydrateDefaultBuilderCanvas(
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const stepLookup = buildWorkflowStepLookup(stepLibrary);
  return draftsToWorkflowNodes(createDefaultOnboardingStepDrafts(), stepLookup);
}

export function ensureNonEmptyBuilderCanvas(
  canvas: { nodes: Node<WorkflowNodeData>[]; edges: Edge[] },
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[]; usedDefault: boolean } {
  if (canvas.nodes.length > 0) {
    return { ...canvas, usedDefault: false };
  }
  return { ...hydrateDefaultBuilderCanvas(stepLibrary), usedDefault: true };
}
