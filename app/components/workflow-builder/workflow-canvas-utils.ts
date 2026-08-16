import type { Edge, Node } from "@xyflow/react";

import {
  DROP_ZONE_HEIGHT,
  DROP_ZONE_WIDTH,
  NODE_VERTICAL_SPACING,
  PARALLEL_BRANCH_OFFSET,
  STEP_NODE_HEIGHT,
  STEP_NODE_WIDTH,
} from "./constants";
import { WORKFLOW_EDGE_TYPE } from "./constants";
import type {
  DropZoneNodeData,
  WorkflowCanvasNodeData,
  WorkflowInsertionPoint,
} from "./types";
import { isDropZoneNode, isStepNode } from "./types";

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

const INSERTION_HIT_PAD_X = 48;
const INSERTION_HIT_PAD_Y = 40;

export type WorkflowInsertionTarget = {
  insertion: WorkflowInsertionPoint;
  key: string;
  bounds: { x: number; y: number; width: number; height: number };
};

function pointInBounds(
  position: { x: number; y: number },
  bounds: WorkflowInsertionTarget["bounds"]
): boolean {
  return (
    position.x >= bounds.x &&
    position.x <= bounds.x + bounds.width &&
    position.y >= bounds.y &&
    position.y <= bounds.y + bounds.height
  );
}

function boundsCenter(bounds: WorkflowInsertionTarget["bounds"]): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function listInsertionTargets(
  nodes: Node<WorkflowCanvasNodeData>[],
  edges: Edge[]
): WorkflowInsertionTarget[] {
  const stepNodes = onlyStepNodes(nodes);
  if (!stepNodes.length) {
    const insertion: WorkflowInsertionPoint = {
      previousNodeId: null,
      nextNodeId: null,
    };
    return [
      {
        insertion,
        key: `${insertion.previousNodeId ?? "start"}->${insertion.nextNodeId ?? "end"}`,
        bounds: {
          x: -400,
          y: -400,
          width: 1200,
          height: 1200,
        },
      },
    ];
  }

  const targets: WorkflowInsertionTarget[] = [];

  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    if (!source || !isStepNode(source) || !target) continue;

    const insertion: WorkflowInsertionPoint = {
      previousNodeId: source.id,
      nextNodeId: target.id,
    };

    if (isDropZoneNode(target)) {
      targets.push({
        insertion,
        key: `${insertion.previousNodeId ?? "start"}->${insertion.nextNodeId ?? "end"}`,
        bounds: {
          x: target.position.x - INSERTION_HIT_PAD_X,
          y: target.position.y - INSERTION_HIT_PAD_Y,
          width: DROP_ZONE_WIDTH + INSERTION_HIT_PAD_X * 2,
          height: DROP_ZONE_HEIGHT + INSERTION_HIT_PAD_Y * 2,
        },
      });
      continue;
    }

    if (!isStepNode(target)) continue;

    const gapTop = source.position.y + STEP_NODE_HEIGHT;
    const gapBottom = target.position.y;
    const gapHeight = Math.max(gapBottom - gapTop, 56);

    targets.push({
      insertion,
      key: `${insertion.previousNodeId ?? "start"}->${insertion.nextNodeId ?? "end"}`,
      bounds: {
        x: Math.min(source.position.x, target.position.x) - INSERTION_HIT_PAD_X,
        y: gapTop - INSERTION_HIT_PAD_Y / 2,
        width: STEP_NODE_WIDTH + INSERTION_HIT_PAD_X * 2,
        height: gapHeight + INSERTION_HIT_PAD_Y,
      },
    });
  }

  return targets;
}

export function findInsertionPointAtPosition(
  nodes: Node<WorkflowCanvasNodeData>[],
  edges: Edge[],
  position: { x: number; y: number }
): WorkflowInsertionPoint | null {
  const hits = listInsertionTargets(nodes, edges).filter((target) =>
    pointInBounds(position, target.bounds)
  );
  if (!hits.length) return null;

  let closest = hits[0];
  let closestDist = Number.POSITIVE_INFINITY;
  for (const hit of hits) {
    const center = boundsCenter(hit.bounds);
    const dist = (center.x - position.x) ** 2 + (center.y - position.y) ** 2;
    if (dist < closestDist) {
      closest = hit;
      closestDist = dist;
    }
  }
  return closest.insertion;
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
