import { describe, expect, it } from "vitest";
import { createWorkflowEdge } from "./constants";
import type { WorkflowCanvasNodeData, WorkflowNodeData } from "./types";
import { DEFAULT_STEP_SETTINGS } from "./types";
import type { Node } from "@xyflow/react";
import {
  buildDropZoneNode,
  findInsertionPointAtPosition,
} from "./workflow-canvas-utils";

function step(id: string, y: number): Node<WorkflowNodeData> {
  return {
    id,
    type: "step",
    position: { x: 120, y },
    data: {
      stepId: id,
      label: id,
      icon: null,
      day: 1,
      required: true,
      settings: { ...DEFAULT_STEP_SETTINGS },
    },
  };
}

describe("findInsertionPointAtPosition", () => {
  it("returns an empty insertion point when the canvas has no steps", () => {
    expect(findInsertionPointAtPosition([], [], { x: 10, y: 10 })).toEqual({
      previousNodeId: null,
      nextNodeId: null,
    });
  });

  it("hits the leaf drop zone with a generous target", () => {
    const a = step("node-a", 40);
    const drop = buildDropZoneNode("drop-1", { x: 120, y: 170 });
    const nodes: Node<WorkflowCanvasNodeData>[] = [a, drop];
    const edges = [createWorkflowEdge("node-a", "drop-1")];

    const hit = findInsertionPointAtPosition(nodes, edges, { x: 140, y: 190 });
    expect(hit).toEqual({ previousNodeId: "node-a", nextNodeId: "drop-1" });
  });

  it("hits the gap between two steps", () => {
    const a = step("node-a", 40);
    const b = step("node-b", 170);
    const nodes: Node<WorkflowCanvasNodeData>[] = [a, b];
    const edges = [createWorkflowEdge("node-a", "node-b")];

    const hit = findInsertionPointAtPosition(nodes, edges, { x: 160, y: 120 });
    expect(hit).toEqual({ previousNodeId: "node-a", nextNodeId: "node-b" });
  });
});
