import type { Edge, Node } from "@xyflow/react";
import type { StepCategory } from "@/app/components/workflow-builder";
import type { WorkflowNodeData } from "@/app/components/workflow-builder";
import { mapConfigToDrafts } from "@/lib/onboarding/config-to-drafts";
import { hydrateWorkflowFromStorage } from "@/lib/onboarding/drafts-to-workflow";
import type { TenantOnboardingConfig } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { buildWorkflowStepLookup } from "@/app/components/onboarding/workflow-step-library";

export type BuilderCanvasPayload = {
  config?: TenantOnboardingConfig | null;
  publishStatus?: "draft" | "published";
  builderDraft?: unknown;
};

export function builderDraftHasCanvas(
  builderDraft: unknown
): builderDraft is SerializableWorkflowState {
  return isSerializableWorkflowState(builderDraft) && builderDraft.nodes.length > 0;
}

/** Applicant-facing published steps → canvas (baseline workers currently see). */
export function hydratePublishedCanvas(
  payload: BuilderCanvasPayload,
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  if (!payload.config) return { nodes: [], edges: [] };
  const drafts = mapConfigToDrafts(payload.config);
  const stepLookup = buildWorkflowStepLookup(stepLibrary);
  return hydrateWorkflowFromStorage(null, drafts, stepLookup);
}

/** Saved builder draft merged with published config metadata. */
export function hydrateDraftCanvas(
  payload: BuilderCanvasPayload,
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  if (!payload.config) return { nodes: [], edges: [] };
  const drafts = mapConfigToDrafts(payload.config);
  const stepLookup = buildWorkflowStepLookup(stepLibrary);
  const draftForHydrate = builderDraftHasCanvas(payload.builderDraft)
    ? payload.builderDraft
    : null;
  return hydrateWorkflowFromStorage(draftForHydrate, drafts, stepLookup);
}

/**
 * Prefer the unsaved builder draft when publish status is draft and a canvas exists;
 * otherwise show the live published workflow applicants currently receive.
 */
export function selectBuilderCanvas(
  payload: BuilderCanvasPayload,
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[]; source: "draft" | "published" } {
  const useDraft =
    payload.publishStatus === "draft" && builderDraftHasCanvas(payload.builderDraft);

  if (useDraft) {
    return { ...hydrateDraftCanvas(payload, stepLibrary), source: "draft" };
  }

  return { ...hydratePublishedCanvas(payload, stepLibrary), source: "published" };
}

export function hydrateCanvasFromBuilderDraft(
  builderDraft: SerializableWorkflowState,
  stepLibrary: StepCategory[]
): { nodes: Node<WorkflowNodeData>[]; edges: Edge[] } {
  const stepLookup = buildWorkflowStepLookup(stepLibrary);
  return hydrateWorkflowFromStorage(builderDraft, [], stepLookup);
}
