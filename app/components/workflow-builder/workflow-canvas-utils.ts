import type { Edge, Node } from "@xyflow/react";

import {
  DROP_ZONE_HEIGHT,
  DROP_ZONE_WIDTH,
  NODE_VERTICAL_SPACING,
  PARALLEL_BRANCH_OFFSET,
  STEP_NODE_HEIGHT,
} from "./constants";
import { WORKFLOW_EDGE_TYPE } from "./constants";
import type { DropZoneNodeData, WorkflowCanvasNodeData } from "./types";
import { isDropZoneNode } from "./types";

export function createDropZoneId(): string {
  return `drop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildDropZoneNode(
  id: string,
  position: { x: number; y: number }
): Node<DropZoneNodeData> {
  return {
    id,
    type: "dropZone",
    position,
    selectable: true,
    draggable: false,
    zIndex: 0,
    data: { kind: "dropZone" },
  };
}

export function dropZonePositionBelow(
  parent: Node<WorkflowCanvasNodeData>
): { x: number; y: number } {
  const parentHeight =
    parent.type === "dropZone" ? DROP_ZONE_HEIGHT : STEP_NODE_HEIGHT;
  return {
    x: parent.position.x,
    y: parent.position.y + parentHeight + NODE_VERTICAL_SPACING - DROP_ZONE_HEIGHT,
  };
}

export function findDropZoneAtPosition(
  nodes: Node<WorkflowCanvasNodeData>[],
  position: { x: number; y: number }
): Node<DropZoneNodeData> | null {
  const hit = nodes.find((n) => {
    if (!isDropZoneNode(n)) return false;
    return (
      position.x >= n.position.x &&
      position.x <= n.position.x + DROP_ZONE_WIDTH &&
      position.y >= n.position.y &&
      position.y <= n.position.y + DROP_ZONE_HEIGHT
    );
  });
  return hit && isDropZoneNode(hit) ? hit : null;
}

export function countDropZoneChildren(
  sourceId: string,
  nodes: Node<WorkflowCanvasNodeData>[],
  edges: Edge[]
): number {
  return edges
    .filter((e) => e.source === sourceId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n) => n && isDropZoneNode(n)).length;
}

export function parallelDropPositions(center: { x: number; y: number }): [
  { x: number; y: number },
  { x: number; y: number },
] {
  return [
    { x: center.x - PARALLEL_BRANCH_OFFSET, y: center.y },
    { x: center.x + PARALLEL_BRANCH_OFFSET, y: center.y },
  ];
}

export function onlyStepNodes(
  nodes: Node<WorkflowCanvasNodeData>[]
): Node<WorkflowCanvasNodeData>[] {
  return nodes.filter((n) => n.type === "step");
}

export function edgesWithoutDropZones(
  nodes: Node<WorkflowCanvasNodeData>[],
  edges: Edge[]
): Edge[] {
  const dropIds = new Set(
    nodes.filter(isDropZoneNode).map((n) => n.id)
  );
  return edges.filter(
    (e) => !dropIds.has(e.source) && !dropIds.has(e.target)
  );
}

/** Adds one drop zone under each step leaf when loading a saved flow. */
export function withLeafDropZones(
  nodes: Node<WorkflowCanvasNodeData>[],
  edges: Edge[]
): { nodes: Node<WorkflowCanvasNodeData>[]; edges: Edge[] } {
  const hasDropZone = nodes.some(isDropZoneNode);
  if (hasDropZone || !nodes.some((n) => n.type === "step")) {
    return { nodes, edges };
  }

  const stepNodes = nodes.filter((n) => n.type === "step");
  const dropIds = new Set(nodes.filter(isDropZoneNode).map((n) => n.id));

  const leaves = stepNodes.filter((step) => {
    const outgoing = edges.filter(
      (e) => e.source === step.id && !dropIds.has(e.target)
    );
    const hasStepChild = outgoing.some((e) => {
      const t = nodes.find((n) => n.id === e.target);
      return t?.type === "step";
    });
    return !hasStepChild;
  });

  if (!leaves.length) return { nodes, edges };

  const newNodes: Node<DropZoneNodeData>[] = [];
  const newEdges: Edge[] = [];

  for (const leaf of leaves) {
    const dropId = createDropZoneId();
    newNodes.push(
      buildDropZoneNode(dropId, dropZonePositionBelow(leaf))
    );
    newEdges.push({
      id: `e-${leaf.id}-${dropId}`,
      source: leaf.id,
      target: dropId,
      type: WORKFLOW_EDGE_TYPE,
    });
  }

  return {
    nodes: [...nodes, ...newNodes],
    edges: [...edges, ...newEdges],
  };
}
