import type { Edge, Node } from "@xyflow/react";
import type { WorkflowCanvasNodeData, WorkflowState } from "@/app/components/workflow-builder/types";
import { isStepNode } from "@/app/components/workflow-builder/types";

/** Deep-enough clone for undo/redo; keeps icon references (not serializable). */
export function cloneWorkflowState(state: WorkflowState): WorkflowState {
  return {
    nodes: state.nodes.map((node) => cloneNode(node)),
    edges: state.edges.map((edge) => ({
      ...edge,
      data:
        edge.data && typeof edge.data === "object"
          ? { ...(edge.data as Record<string, unknown>) }
          : edge.data,
    })),
  };
}

function cloneNode(node: Node<WorkflowCanvasNodeData>): Node<WorkflowCanvasNodeData> {
  if (isStepNode(node)) {
    const { onDelete: _onDelete, ...restData } = node.data;
    return {
      ...node,
      position: { ...node.position },
      data: {
        ...restData,
        settings: { ...node.data.settings },
        icon: node.data.icon,
      },
    };
  }
  return {
    ...node,
    position: { ...node.position },
    data: { ...node.data },
  };
}
