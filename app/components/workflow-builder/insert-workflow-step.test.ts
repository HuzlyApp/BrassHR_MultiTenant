import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { createWorkflowEdge } from "./constants";
import {
  createWorkflowNodeId,
  insertWorkflowStep,
} from "./insert-workflow-step";
import { serializeWorkflowState } from "@/lib/onboarding/workflow-builder-serialization";
import type {
  StepDefinition,
  WorkflowCanvasNodeData,
  WorkflowNodeData,
} from "./types";
import { DEFAULT_STEP_SETTINGS } from "./types";
import { buildDropZoneNode } from "./workflow-canvas-utils";

function def(id: string, label: string, extra?: Partial<StepDefinition>): StepDefinition {
  return { id, label, icon: null, ...extra };
}

function stepNode(
  id: string,
  stepId: string,
  label: string,
  y: number,
  phase: "pre_hire" | "post_hire" = "pre_hire"
): Node<WorkflowNodeData> {
  return {
    id,
    type: "step",
    position: { x: 120, y },
    data: {
      stepId,
      label,
      icon: null,
      day: Math.floor(y / 130) + 1,
      required: true,
      settings: { ...DEFAULT_STEP_SETTINGS, phase },
    },
  };
}

describe("insertWorkflowStep", () => {
  it("does not clone the preceding References Collection node when inserting after it", () => {
    const references = stepNode("node-ref", "references-collection", "References Collection", 40);
    const drop = buildDropZoneNode("drop-1", { x: 120, y: 170 });
    const nodes: Node<WorkflowCanvasNodeData>[] = [references, drop];
    const edges: Edge[] = [createWorkflowEdge("node-ref", "drop-1")];

    const result = insertWorkflowStep({
      nodes,
      edges,
      stepDefinition: def("policy-acknowledgment", "Policy Acknowledgment"),
      insertionPoint: { previousNodeId: "node-ref", nextNodeId: "drop-1" },
      createNodeId: () => "node-policy",
      createDropId: () => "drop-2",
    });

    const steps = result.nodes.filter((n) => n.type === "step");
    expect(steps.map((n) => (n.data as WorkflowNodeData).stepId)).toEqual([
      "references-collection",
      "policy-acknowledgment",
    ]);
    expect(result.newNodeId).toBe("node-policy");
    expect(result.nodes.some((n) => n.id === "drop-1")).toBe(false);
    expect(result.edges.some((e) => e.source === "node-ref" && e.target === "node-policy")).toBe(
      true
    );
    expect(result.edges.some((e) => e.source === "node-policy" && e.target === "drop-2")).toBe(true);
    expect(result.edges.some((e) => e.source === "node-ref" && e.target === "drop-1")).toBe(false);
  });

  it("inserts between two steps and rewires A → C → B without leaving A → B", () => {
    const a = stepNode("node-a", "document-upload", "Document Upload", 40);
    const b = stepNode("node-b", "tax-forms", "Tax Forms (W-4 / State)", 170);
    const nodes: Node<WorkflowCanvasNodeData>[] = [a, b];
    const edges: Edge[] = [createWorkflowEdge("node-a", "node-b")];

    const result = insertWorkflowStep({
      nodes,
      edges,
      stepDefinition: def("policy-acknowledgment", "Policy Acknowledgment"),
      insertionPoint: { previousNodeId: "node-a", nextNodeId: "node-b" },
      createNodeId: () => "node-c",
    });

    const stepEdges = result.edges.filter((e) =>
      result.nodes.some((n) => n.id === e.target && n.type === "step")
    );
    expect(stepEdges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
      "node-a->node-c",
      "node-c->node-b",
    ]);
    expect(result.edges.some((e) => e.source === "node-a" && e.target === "node-b")).toBe(false);
  });

  it("appends at the end of A → B", () => {
    const a = stepNode("node-a", "document-upload", "Document Upload", 40);
    const b = stepNode("node-b", "tax-forms", "Tax Forms (W-4 / State)", 170);
    const drop = buildDropZoneNode("drop-end", { x: 120, y: 300 });
    const nodes: Node<WorkflowCanvasNodeData>[] = [a, b, drop];
    const edges: Edge[] = [
      createWorkflowEdge("node-a", "node-b"),
      createWorkflowEdge("node-b", "drop-end"),
    ];

    const result = insertWorkflowStep({
      nodes,
      edges,
      stepDefinition: def("welcome-packet-esign", "Welcome Packet & eSign"),
      insertionPoint: { previousNodeId: "node-b", nextNodeId: "drop-end" },
      createNodeId: () => "node-c",
      createDropId: () => "drop-new",
    });

    const steps = result.nodes.filter((n) => n.type === "step");
    expect(steps.map((n) => (n.data as WorkflowNodeData).stepId)).toEqual([
      "document-upload",
      "tax-forms",
      "welcome-packet-esign",
    ]);
    expect(result.edges.some((e) => e.source === "node-a" && e.target === "node-b")).toBe(true);
    expect(result.edges.some((e) => e.source === "node-b" && e.target === "node-c")).toBe(true);
    expect(result.edges.some((e) => e.source === "node-c" && e.target === "drop-new")).toBe(true);
  });

  it("creates unique node IDs when the same step definition is added twice", () => {
    const empty = insertWorkflowStep({
      nodes: [],
      edges: [],
      stepDefinition: def("document-upload", "Document Upload"),
      insertionPoint: { previousNodeId: null, nextNodeId: null },
      createNodeId: () => "uuid-1",
      createDropId: () => "drop-1",
    });

    const second = insertWorkflowStep({
      nodes: empty.nodes,
      edges: empty.edges,
      stepDefinition: def("document-upload", "Document Upload"),
      insertionPoint: { previousNodeId: "uuid-1", nextNodeId: "drop-1" },
      createNodeId: () => "uuid-2",
      createDropId: () => "drop-2",
    });

    const steps = second.nodes.filter((n) => n.type === "step") as Node<WorkflowNodeData>[];
    expect(steps.map((n) => n.id)).toEqual(["uuid-1", "uuid-2"]);
    expect(steps.every((n) => n.data.stepId === "document-upload")).toBe(true);
    expect(new Set(steps.map((n) => n.id)).size).toBe(2);
  });

  it("does not copy the previous node's phase onto the inserted step", () => {
    const references = stepNode(
      "node-ref",
      "references-collection",
      "References Collection",
      40,
      "pre_hire"
    );
    const drop = buildDropZoneNode("drop-1", { x: 120, y: 170 });

    const result = insertWorkflowStep({
      nodes: [references, drop],
      edges: [createWorkflowEdge("node-ref", "drop-1")],
      stepDefinition: def("tax-forms", "Tax Forms (W-4 / State)", {
        defaultPhase: "post_hire",
      }),
      insertionPoint: { previousNodeId: "node-ref", nextNodeId: "drop-1" },
      createNodeId: () => "node-tax",
      createDropId: () => "drop-2",
    });

    const tax = result.nodes.find((n) => n.id === "node-tax") as Node<WorkflowNodeData>;
    expect(tax.data.stepId).toBe("tax-forms");
    expect(tax.data.settings.phase).toBe("post_hire");
    expect((result.nodes.find((n) => n.id === "node-ref") as Node<WorkflowNodeData>).data.stepId).toBe(
      "references-collection"
    );
  });

  it("persists the inserted step definition, not References Collection, after serialize", () => {
    const references = stepNode("node-ref", "references-collection", "References Collection", 40);
    const drop = buildDropZoneNode("drop-1", { x: 120, y: 170 });
    const result = insertWorkflowStep({
      nodes: [references, drop],
      edges: [createWorkflowEdge("node-ref", "drop-1")],
      stepDefinition: def("tax-forms", "Tax Forms (W-4 / State)"),
      insertionPoint: { previousNodeId: "node-ref", nextNodeId: "drop-1" },
      createNodeId: () => "node-tax",
      createDropId: () => "drop-2",
    });

    const serialized = serializeWorkflowState(result.nodes, result.edges);
    expect(serialized.nodes.map((n) => n.stepId)).toEqual([
      "references-collection",
      "tax-forms",
    ]);
    expect(serialized.edges.map((e) => `${e.source}->${e.target}`)).toEqual([
      "node-ref->node-tax",
    ]);
  });

  it("undo restores the pre-insert snapshot", () => {
    const beforeNodes = [
      stepNode("node-ref", "references-collection", "References Collection", 40),
      buildDropZoneNode("drop-1", { x: 120, y: 170 }),
    ];
    const beforeEdges = [createWorkflowEdge("node-ref", "drop-1")];

    const after = insertWorkflowStep({
      nodes: beforeNodes,
      edges: beforeEdges,
      stepDefinition: def("policy-acknowledgment", "Policy Acknowledgment"),
      insertionPoint: { previousNodeId: "node-ref", nextNodeId: "drop-1" },
      createNodeId: () => "node-policy",
      createDropId: () => "drop-2",
    });

    expect(after.nodes).not.toEqual(beforeNodes);

    const undoneNodes = beforeNodes;
    const redone = insertWorkflowStep({
      nodes: undoneNodes,
      edges: beforeEdges,
      stepDefinition: def("policy-acknowledgment", "Policy Acknowledgment"),
      insertionPoint: { previousNodeId: "node-ref", nextNodeId: "drop-1" },
      createNodeId: () => "node-policy",
      createDropId: () => "drop-2",
    });

    expect(redone.newNodeId).toBe("node-policy");
    expect(
      (redone.nodes.find((n) => n.id === "node-policy") as Node<WorkflowNodeData>).data.stepId
    ).toBe("policy-acknowledgment");
  });

  it("generates unique node IDs that are not the step definition id", () => {
    const id = createWorkflowNodeId();
    expect(id.startsWith("node-")).toBe(true);
    expect(id).not.toBe("policy-acknowledgment");
    expect(createWorkflowNodeId()).not.toBe(createWorkflowNodeId());
  });
});
