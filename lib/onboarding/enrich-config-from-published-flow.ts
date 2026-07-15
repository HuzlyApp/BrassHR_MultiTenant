import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import {
  getFirmaRecruiterTemplateId,
} from "@/lib/onboarding/firma-step-settings";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowNode,
} from "@/lib/onboarding/workflow-builder-serialization";
import { isBackgroundCheckAuthorizationStep } from "@/lib/onboarding/authorizations-documents-step";

function workflowSettingsRecord(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  const raw = metadata?.workflow_settings;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

function mergeNodeSettingsOntoStep(
  step: TenantOnboardingStep,
  node: SerializableWorkflowNode
): TenantOnboardingStep {
  const templateId = node.settings.firmaRecruiterTemplateId?.trim();
  if (!templateId) return step;

  return {
    ...step,
    metadata: {
      ...step.metadata,
      workflow_step_id:
        (typeof step.metadata?.workflow_step_id === "string" && step.metadata.workflow_step_id.trim()) ||
        node.stepId,
      workflow_node_id:
        (typeof step.metadata?.workflow_node_id === "string" && step.metadata.workflow_node_id.trim()) ||
        node.id,
      workflow_settings: {
        ...workflowSettingsRecord(step.metadata),
        ...node.settings,
      },
    },
  };
}

function matchFlowNodeForStep(
  step: TenantOnboardingStep,
  nodes: SerializableWorkflowNode[]
): SerializableWorkflowNode | null {
  const nodeId = step.metadata?.workflow_node_id;
  if (typeof nodeId === "string" && nodeId.trim()) {
    const byId = nodes.find((node) => node.id === nodeId);
    if (byId) return byId;
  }

  const workflowStepId = step.metadata?.workflow_step_id;
  if (typeof workflowStepId === "string" && workflowStepId.trim()) {
    const byStepId = nodes.find((node) => node.stepId === workflowStepId);
    if (byStepId) return byStepId;
  }

  const byCanvasId = nodes.find((node) => node.id === `step-${step.step_key}`);
  if (byCanvasId) return byCanvasId;

  return null;
}

function findAgreementNodeWithFirma(
  nodes: SerializableWorkflowNode[]
): SerializableWorkflowNode | null {
  return (
    nodes.find(
      (node) =>
        node.stepId === "employee-agreement" &&
        Boolean(node.settings.firmaRecruiterTemplateId?.trim())
    ) ??
    nodes.find((node) => Boolean(node.settings.firmaRecruiterTemplateId?.trim())) ??
    null
  );
}

/**
 * Overlays Firma template settings from the tenant's published onboarding flow onto
 * applicant-facing steps when persisted step metadata is missing them (e.g. stale cache
 * or publish sync lag).
 */
export async function enrichTenantConfigFromPublishedFlow(
  supabase: OnboardingDbClient,
  tenantId: string,
  config: TenantOnboardingConfig
): Promise<TenantOnboardingConfig> {
  const { data: flowRow, error } = await supabase
    .from("onboarding_flows")
    .select("builder_draft")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const draftRaw = flowRow?.builder_draft;
  if (!isSerializableWorkflowState(draftRaw) || !draftRaw.nodes.length) {
    return config;
  }

  const nodes = draftRaw.nodes;
  const agreementNode = findAgreementNodeWithFirma(nodes);
  let changed = false;

  const steps = config.steps.map((step) => {
    if (getFirmaRecruiterTemplateId(step)) return step;

    const matchedNode = matchFlowNodeForStep(step, nodes);
    if (matchedNode?.settings.firmaRecruiterTemplateId?.trim()) {
      changed = true;
      return mergeNodeSettingsOntoStep(step, matchedNode);
    }

    if (
      (step.step_type === "authorizations" || isBackgroundCheckAuthorizationStep(step)) &&
      agreementNode
    ) {
      changed = true;
      return mergeNodeSettingsOntoStep(step, agreementNode);
    }

    return step;
  });

  if (!changed) return config;
  return { ...config, steps };
}
