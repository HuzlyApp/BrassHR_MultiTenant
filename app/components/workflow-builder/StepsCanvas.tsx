"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  addEdge,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnConnect,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import WorkflowConnectorEdge from "./edges/WorkflowConnectorEdge";
import StepNode from "./nodes/StepNode";
import {
  WORKFLOW_CONNECTOR_COLOR,
  WORKFLOW_CONNECTOR_STROKE_WIDTH,
  WORKFLOW_EDGE_TYPE,
  createWorkflowEdge,
  DRAG_DATA_TYPE,
  GOLD,
  TEXT_MUTED,
} from "./constants";
import type { StepCategory, StepDefinition, WorkflowNodeData } from "./types";
import { normalizeWorkflowNodeSettings } from "@/lib/onboarding/normalize-workflow-settings";

type StepsCanvasProps = {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<WorkflowNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: (changes: NodeChange<Node<WorkflowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  categories: StepCategory[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
};

const nodeTypes = { step: StepNode };
const edgeTypes = { [WORKFLOW_EDGE_TYPE]: WorkflowConnectorEdge };

const NODE_VERTICAL_SPACING = 130;

function buildStepNode(
  id: string,
  def: StepDefinition,
  position: { x: number; y: number },
  day: number
): Node<WorkflowNodeData> {
  return {
    id,
    type: "step",
    position,
    data: {
      stepId: def.id,
      label: def.label,
      description: def.description ?? null,
      icon: def.icon,
      day,
      required: true,
      settings: normalizeWorkflowNodeSettings(undefined, {
        required: true,
        day,
      }),
    },
  };
}

export default function StepsCanvas({
  nodes,
  edges,
  setNodes,
  setEdges,
  onNodesChange,
  onEdgesChange,
  categories,
  selectedNodeId,
  onSelectNode,
}: StepsCanvasProps) {
  const { screenToFlowPosition } = useReactFlow<Node<WorkflowNodeData>, Edge>();
  const [edgeRemoveModeId, setEdgeRemoveModeId] = useState<string | null>(null);

  const stepById = useMemo(() => {
    const map = new Map<string, StepDefinition>();
    categories.forEach((c) => c.steps.forEach((s) => map.set(s.id, s)));
    return map;
  }, [categories]);

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      setEdgeRemoveModeId(null);
    },
    [setEdges]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => {
        const incoming = prev.filter((e) => e.target === id);
        const outgoing = prev.filter((e) => e.source === id);
        const without = prev.filter((e) => e.source !== id && e.target !== id);

        const bridges: Edge[] = [];
        for (const inn of incoming) {
          for (const out of outgoing) {
            const exists = without.some(
              (e) => e.source === inn.source && e.target === out.target
            );
            if (!exists && inn.source !== out.target) {
              bridges.push(createWorkflowEdge(inn.source, out.target));
            }
          }
        }
        return [...without, ...bridges];
      });
      if (selectedNodeId === id) onSelectNode(null);
    },
    [setNodes, setEdges, selectedNodeId, onSelectNode]
  );

  const handleInsertBetween = useCallback(
    (sourceId: string, targetId: string) => {
      const source = nodes.find((n) => n.id === sourceId);
      const target = nodes.find((n) => n.id === targetId);
      if (!source || !target) return;

      const def = stepById.get(source.data.stepId);
      if (!def) return;

      const id = `node-${Date.now()}`;
      const insertY = target.position.y;

      setNodes((prev) => {
        const shifted = prev.map((n) => {
          if (n.position.y >= insertY) {
            return {
              ...n,
              position: { ...n.position, y: n.position.y + NODE_VERTICAL_SPACING },
            };
          }
          return n;
        });
        return [
          ...shifted,
          buildStepNode(
            id,
            def,
            { x: source.position.x, y: insertY },
            source.data.day + 1
          ),
        ];
      });

      setEdges((prev) => {
        const without = prev.filter(
          (e) => !(e.source === sourceId && e.target === targetId)
        );
        return [...without, createWorkflowEdge(sourceId, id), createWorkflowEdge(id, targetId)];
      });

      onSelectNode(id);
    },
    [nodes, stepById, setNodes, setEdges, onSelectNode]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) =>
        addEdge(createWorkflowEdge(connection.source!, connection.target!), eds)
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const stepId = e.dataTransfer.getData(DRAG_DATA_TYPE);
      if (!stepId) return;

      const def = stepById.get(stepId);
      if (!def) return;

      const id = `node-${Date.now()}`;
      const isFirstNode = nodes.length === 0;

      let position: { x: number; y: number };
      let day = 1;
      let lastNodeId: string | null = null;

      if (isFirstNode) {
        position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      } else {
        const sortedByY = [...nodes].sort((a, b) => b.position.y - a.position.y);
        const lastNode = sortedByY[0];
        position = {
          x: lastNode.position.x,
          y: lastNode.position.y + NODE_VERTICAL_SPACING,
        };
        day = lastNode.data.day + 1;
        lastNodeId = lastNode.id;
      }

      const newNode = buildStepNode(id, def, position, day);
      setNodes((prev) => [...prev, newNode]);

      if (lastNodeId) {
        setEdges((prev) => [...prev, createWorkflowEdge(lastNodeId!, id)]);
      }

      onSelectNode(id);
    },
    [screenToFlowPosition, stepById, nodes, setNodes, setEdges, onSelectNode]
  );

  const handleNodeClick: NodeMouseHandler<Node<WorkflowNodeData>> = useCallback(
    (_e, node) => {
      setEdgeRemoveModeId(null);
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const handlePaneClick = useCallback(() => {
    setEdgeRemoveModeId(null);
    onSelectNode(null);
  }, [onSelectNode]);

  const enhancedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
        data: {
          ...n.data,
          onDelete: handleDeleteNode,
        },
      })),
    [nodes, selectedNodeId, handleDeleteNode]
  );

  const enhancedEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        type: WORKFLOW_EDGE_TYPE,
        style: {
          stroke: WORKFLOW_CONNECTOR_COLOR,
          strokeWidth: WORKFLOW_CONNECTOR_STROKE_WIDTH,
        },
        data: {
          removeMode: edgeRemoveModeId === e.id,
          onEnterRemoveMode: setEdgeRemoveModeId,
          onExitRemoveMode: () => setEdgeRemoveModeId(null),
          onInsertBetween: handleInsertBetween,
          onDeleteEdge: handleDeleteEdge,
        },
      })),
    [edgeRemoveModeId, edges, handleInsertBetween, handleDeleteEdge]
  );

  return (
    <div
      className="relative h-full flex-1 overflow-hidden"
      style={{ backgroundColor: "transparent" }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={enhancedNodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesFocusable
        edgesReconnectable={false}
        deleteKeyCode={null}
        onPaneContextMenu={(e) => e.preventDefault()}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          type: WORKFLOW_EDGE_TYPE,
          style: {
            stroke: WORKFLOW_CONNECTOR_COLOR,
            strokeWidth: WORKFLOW_CONNECTOR_STROKE_WIDTH,
          },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#d0d5dd"
        />
        <Controls showInteractive={false} />
      </ReactFlow>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed bg-white/60 px-8 py-10 text-center"
            style={{ borderColor: GOLD }}
          >
            <span
              className="text-sm font-semibold leading-5"
              style={{ color: "#101828" }}
            >
              Drag steps here
            </span>
            <span className="text-xs" style={{ color: TEXT_MUTED }}>
              Drop a step from the library to start building your flow
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
