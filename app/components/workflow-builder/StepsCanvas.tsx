"use client";

import { useCallback, useMemo } from "react";
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

import StepNode from "./nodes/StepNode";
import { CARD_BORDER, DRAG_DATA_TYPE, GOLD, TEXT_MUTED } from "./constants";
import {
  DEFAULT_STEP_SETTINGS,
  type StepCategory,
  type StepDefinition,
  type WorkflowNodeData,
} from "./types";

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

const NODE_VERTICAL_SPACING = 130;

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

  const stepById = useMemo(() => {
    const map = new Map<string, StepDefinition>();
    categories.forEach((c) => c.steps.forEach((s) => map.set(s.id, s)));
    return map;
  }, [categories]);

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
      if (selectedNodeId === id) onSelectNode(null);
    },
    [setNodes, setEdges, selectedNodeId, onSelectNode]
  );

  const handleAddNext = useCallback(
    (sourceId: string) => {
      const source = nodes.find((n) => n.id === sourceId);
      if (!source) return;

      const def = stepById.get(source.data.stepId);
      if (!def) return;

      const id = `node-${Date.now()}`;
      const newNode: Node<WorkflowNodeData> = {
        id,
        type: "step",
        position: {
          x: source.position.x,
          y: source.position.y + NODE_VERTICAL_SPACING,
        },
        data: {
          stepId: def.id,
          label: def.label,
          description: def.description ?? null,
          icon: def.icon,
          day: source.data.day + 1,
          required: true,
          settings: { ...DEFAULT_STEP_SETTINGS },
        },
      };
      setNodes((prev) => [...prev, newNode]);
      setEdges((prev) => [
        ...prev,
        {
          id: `e-${sourceId}-${id}`,
          source: sourceId,
          target: id,
          type: "smoothstep",
          style: { stroke: "#94A3B8", strokeWidth: 1.5 },
        },
      ]);
    },
    [nodes, stepById, setNodes, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            style: { stroke: "#94A3B8", strokeWidth: 1.5 },
          },
          eds
        )
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

      const newNode: Node<WorkflowNodeData> = {
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
          settings: { ...DEFAULT_STEP_SETTINGS, datePriority: `Day ${day}` },
        },
      };

      setNodes((prev) => [...prev, newNode]);

      if (lastNodeId) {
        setEdges((prev) => [
          ...prev,
          {
            id: `e-${lastNodeId}-${id}`,
            source: lastNodeId,
            target: id,
            type: "smoothstep",
            style: { stroke: "#94A3B8", strokeWidth: 1.5 },
          },
        ]);
      }

      onSelectNode(id);
    },
    [screenToFlowPosition, stepById, nodes, setNodes, setEdges, onSelectNode]
  );

  const handleNodeClick: NodeMouseHandler<Node<WorkflowNodeData>> = useCallback(
    (_e, node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const handlePaneClick = useCallback(() => {
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
          onAddNext: handleAddNext,
        },
      })),
    [nodes, selectedNodeId, handleDeleteNode, handleAddNext]
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
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#94A3B8", strokeWidth: 1.5 },
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
