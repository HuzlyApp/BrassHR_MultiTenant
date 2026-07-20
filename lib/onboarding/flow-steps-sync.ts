import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { normalizeWorkflowNodeSettings } from "@/lib/onboarding/normalize-workflow-settings";
import {
  isSerializableWorkflowState,
  orderedNodeIds,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";

export type OnboardingFlowStepRow = {
  id: string;
  flow_id: string;
  step_type: string;
  title: string;
  description: string | null;
  position: number;
  parent_step_id: string | null;
  day: number;
  is_required: boolean;
  // Phase/conditional columns are optional for backwards compatibility.
  phase?: "pre_hire" | "transition" | "post_hire" | null;
  phase_order?: number | null;
  step_order?: number | null;
  is_conditional?: boolean | null;
  unlock_condition?: string | null;
  completion_owner?: string | null;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  canvas_node_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function formatSupabaseError(context: string, error: { message?: string; details?: string; hint?: string }): Error {
  const parts = [error.message, error.details, error.hint].filter(Boolean);
  return new Error(parts.length ? `${context}: ${parts.join(" — ")}` : context);
}

export function builderDraftToFlowStepInserts(
  flowId: string,
  draft: SerializableWorkflowState
): Array<{
  flow_id: string;
  step_type: string;
  title: string;
  description: string | null;
  position: number;
  parent_step_id: string | null;
  day: number;
  is_required: boolean;
  settings: Record<string, unknown>;
  metadata: Record<string, unknown>;
  canvas_node_id: string;
}> {
  const order = orderedNodeIds(draft.nodes, draft.edges);
  const nodeById = new Map(draft.nodes.map((n) => [n.id, n]));
  const parentByTarget = new Map(draft.edges.map((e) => [e.target, e.source]));

  return order.map((nodeId, index) => {
    const node = nodeById.get(nodeId);
    if (!node) {
      return {
        flow_id: flowId,
        step_type: "custom_question",
        title: "Step",
        description: null,
        position: index + 1,
        parent_step_id: null,
        day: 1,
        is_required: false,
        settings: {},
        metadata: {},
        canvas_node_id: nodeId,
      };
    }

    const parentCanvasId = parentByTarget.get(nodeId) ?? null;

    return {
      flow_id: flowId,
      step_type: node.stepId,
      title: node.label,
      description: node.description ?? null,
      position: index + 1,
      parent_step_id: null,
      day: node.day,
      is_required: node.required,
      settings: node.settings as Record<string, unknown>,
      metadata: { library_step_key: node.stepId, parent_canvas_node_id: parentCanvasId },
      canvas_node_id: nodeId,
    };
  });
}

export async function replaceFlowStepsFromDraft(
  supabase: OnboardingDbClient,
  flowId: string,
  draft: SerializableWorkflowState
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("onboarding_flow_steps")
    .delete()
    .eq("flow_id", flowId);
  if (deleteError) {
    throw formatSupabaseError("Failed to clear flow steps", deleteError);
  }

  const inserts = builderDraftToFlowStepInserts(flowId, draft);
  if (!inserts.length) return;

  const { data, error } = await supabase
    .from("onboarding_flow_steps")
    .insert(
      inserts.map((row) => ({
        flow_id: row.flow_id,
        step_type: row.step_type,
        title: row.title,
        description: row.description,
        position: row.position,
        parent_step_id: null,
        day: row.day,
        is_required: row.is_required,
        settings: row.settings,
        metadata: row.metadata,
        canvas_node_id: row.canvas_node_id,
      }))
    )
    .select("id, canvas_node_id");

  if (error) {
    throw formatSupabaseError("Failed to save flow steps", error);
  }

  const canvasToDbId = new Map(
    (data ?? []).map((row) => [String(row.canvas_node_id), String(row.id)])
  );

  for (const row of inserts) {
    const parentCanvas = row.metadata.parent_canvas_node_id as string | null;
    if (!parentCanvas) continue;
    const parentDbId = canvasToDbId.get(parentCanvas);
    const selfDbId = canvasToDbId.get(row.canvas_node_id);
    if (!parentDbId || !selfDbId) continue;
    const { error: parentError } = await supabase
      .from("onboarding_flow_steps")
      .update({ parent_step_id: parentDbId })
      .eq("id", selfDbId);
    if (parentError) {
      throw formatSupabaseError("Failed to link flow step parents", parentError);
    }
  }
}

export async function loadFlowBuilderDraft(
  supabase: OnboardingDbClient,
  flowId: string,
  fallbackDraft: unknown
): Promise<SerializableWorkflowState> {
  const { data: steps, error } = await supabase
    .from("onboarding_flow_steps")
    .select(
      "id, flow_id, step_type, title, description, position, parent_step_id, day, is_required, settings, metadata, canvas_node_id"
    )
    .eq("flow_id", flowId)
    .order("position", { ascending: true });

  if (error) throw formatSupabaseError("Failed to load flow steps", error);
  return stepsToBuilderDraft(steps as OnboardingFlowStepRow[] | null, fallbackDraft);
}

export async function loadTemplateBuilderDraft(
  supabase: OnboardingDbClient,
  templateId: string,
  fallbackDraft: unknown
): Promise<SerializableWorkflowState> {
  const { data: steps, error } = await supabase
    .from("onboarding_template_steps")
    .select(
      "id, template_id, step_type, title, description, position, parent_step_id, day, is_required, settings, metadata, canvas_node_id"
    )
    .eq("template_id", templateId)
    .order("position", { ascending: true });

  if (error) throw error;

  if (!steps?.length) {
    if (isSerializableWorkflowState(fallbackDraft)) return fallbackDraft;
    return { nodes: [], edges: [] };
  }

  const typedSteps = steps.map((step) => ({
    ...step,
    flow_id: templateId,
  })) as OnboardingFlowStepRow[];

  return stepsToBuilderDraft(typedSteps, fallbackDraft);
}

function stepsToBuilderDraft(
  steps: OnboardingFlowStepRow[] | null,
  fallbackDraft: unknown
): SerializableWorkflowState {
  if (!steps?.length) {
    if (isSerializableWorkflowState(fallbackDraft)) return fallbackDraft;
    return { nodes: [], edges: [] };
  }

  const typedSteps = steps;
  const nodes = typedSteps.map((step, index) => {
    const meta = step.metadata ?? {};
    const libraryKey =
      typeof meta.library_step_key === "string" ? meta.library_step_key : step.step_type;
    const nodeId = step.canvas_node_id ?? `step-${step.id}`;

    return {
      id: nodeId,
      stepId: libraryKey,
      label: step.title,
      description: step.description,
      position: { x: 120, y: 40 + index * 130 },
      day: step.day,
      required: step.is_required,
      settings: normalizeWorkflowNodeSettings(
        {
          ...(step.settings ?? {}),
          phase:
            (step.settings as Record<string, unknown> | undefined)?.phase === "transition" ||
            (step.settings as Record<string, unknown> | undefined)?.phase === "post_hire"
              ? ((step.settings as Record<string, unknown>).phase as "transition" | "post_hire")
              : "pre_hire",
          phaseOrder:
            typeof (step.settings as Record<string, unknown> | undefined)?.phaseOrder === "number"
              ? Number((step.settings as Record<string, unknown>).phaseOrder)
              : undefined,
          stepOrder:
            typeof (step.settings as Record<string, unknown> | undefined)?.stepOrder === "number"
              ? Number((step.settings as Record<string, unknown>).stepOrder)
              : step.position,
          isConditional:
            (step.settings as Record<string, unknown> | undefined)?.isConditional === true,
          unlockCondition:
            typeof (step.settings as Record<string, unknown> | undefined)?.unlockCondition ===
            "string"
              ? String((step.settings as Record<string, unknown>).unlockCondition)
              : "",
          completionOwner:
            typeof (step.settings as Record<string, unknown> | undefined)?.completionOwner ===
            "string"
              ? String((step.settings as Record<string, unknown>).completionOwner)
              : "",
        },
        {
          required: step.is_required,
          day: step.day,
        }
      ),
    };
  });

  const idByDbId = new Map(typedSteps.map((s) => [s.id, s.canvas_node_id ?? `step-${s.id}`]));
  const edges: SerializableWorkflowState["edges"] = [];

  for (const step of typedSteps) {
    if (!step.parent_step_id) continue;
    const source = idByDbId.get(step.parent_step_id);
    const target = step.canvas_node_id ?? `step-${step.id}`;
    if (source && target) {
      edges.push({ id: `e-${source}-${target}`, source, target });
    }
  }

  if (!edges.length && nodes.length > 1) {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
      });
    }
  }

  return { nodes, edges };
}
