import type { Edge, Node } from "@xyflow/react";
import type { StepSettings, WorkflowNodeData } from "@/app/components/workflow-builder/types";
import { DEFAULT_STEP_SETTINGS } from "@/app/components/workflow-builder/types";

export type SerializableWorkflowNode = {
  id: string;
  stepId: string;
  label: string;
  description?: string | null;
  position: { x: number; y: number };
  day: number;
  required: boolean;
  settings: StepSettings;
};

export type SerializableWorkflowState = {
  nodes: SerializableWorkflowNode[];
  edges: Array<{ id: string; source: string; target: string }>;
};

export function serializeWorkflowState(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[]
): SerializableWorkflowState {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      stepId: n.data.stepId,
      label: n.data.label,
      description: typeof n.data.description === "string" ? n.data.description : null,
      position: { x: n.position.x, y: n.position.y },
      day: n.data.day,
      required: n.data.required,
      settings: n.data.settings,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}

export function orderedNodeIds(
  nodes: SerializableWorkflowNode[],
  edges: SerializableWorkflowState["edges"]
): string[] {
  if (!nodes.length) return [];
  if (!edges.length) {
    return [...nodes]
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
      .map((n) => n.id);
  }

  const targets = new Set(edges.map((e) => e.target));
  const start = nodes.find((n) => !targets.has(n.id)) ?? nodes[0];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nextBySource = new Map(edges.map((e) => [e.source, e.target]));

  const ordered: string[] = [];
  const seen = new Set<string>();
  let current: SerializableWorkflowNode | undefined = start;

  while (current && !seen.has(current.id)) {
    ordered.push(current.id);
    seen.add(current.id);
    const nextId = nextBySource.get(current.id);
    current = nextId ? byId.get(nextId) : undefined;
  }

  for (const node of nodes) {
    if (!seen.has(node.id)) ordered.push(node.id);
  }

  return ordered;
}

export function isSerializableWorkflowState(value: unknown): value is SerializableWorkflowState {
  if (!value || typeof value !== "object") return false;
  const v = value as SerializableWorkflowState;
  return Array.isArray(v.nodes) && Array.isArray(v.edges);
}

export function defaultSerializableSettings(): StepSettings {
  return { ...DEFAULT_STEP_SETTINGS };
}
