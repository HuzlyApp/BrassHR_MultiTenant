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
import "./workflow-builder-canvas.css";

import type { ConnectorMenuAction } from "./ConnectorActionMenu";
import WorkflowConnectorEdge from "./edges/WorkflowConnectorEdge";
import DropZoneNode from "./nodes/DropZoneNode";
import StepNode from "./nodes/StepNode";
import {
  WORKFLOW_CONNECTOR_COLOR,
  WORKFLOW_CONNECTOR_STROKE_WIDTH,
  WORKFLOW_EDGE_TYPE,
  createWorkflowEdge,
  DRAG_DATA_TYPE,
  GOLD,
  NODE_VERTICAL_SPACING,
  TEXT_MUTED,
} from "./constants";
import type { StepCategory, StepDefinition, WorkflowNodeData } from "./types";
import {
  isDropZoneNode,
  isStepNode,
  type WorkflowCanvasNodeData,
} from "./types";
import {
  buildDropZoneNode,
  createDropZoneId,
  dropZonePositionBelow,
  findDropZoneAtPosition,
  countDropZoneChildren,
  parallelDropPositions,
  onlyStepNodes,
} from "./workflow-canvas-utils";
import { normalizeWorkflowNodeSettings } from "@/lib/onboarding/normalize-workflow-settings";

type StepsCanvasProps = {
  nodes: Node<WorkflowCanvasNodeData>[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node<WorkflowCanvasNodeData>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: (changes: NodeChange<Node<WorkflowCanvasNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  categories: StepCategory[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
};

const nodeTypes = { step: StepNode, dropZone: DropZoneNode };
const edgeTypes = { [WORKFLOW_EDGE_TYPE]: WorkflowConnectorEdge };

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

function dayAfterSource(
  nodes: Node<WorkflowCanvasNodeData>[],
  sourceId: string
): number {
  const source = nodes.find((n) => n.id === sourceId);
  if (source && isStepNode(source)) return source.data.day + 1;
  const steps = onlyStepNodes(nodes) as Node<WorkflowNodeData>[];
  if (!steps.length) return 1;
  return Math.max(...steps.map((n) => n.data.day)) + 1;
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
  const { screenToFlowPosition } = useReactFlow<
    Node<WorkflowCanvasNodeData>,
    Edge
  >();

  const stepById = useMemo(() => {
    const map = new Map<string, StepDefinition>();
    categories.forEach((c) => c.steps.forEach((s) => map.set(s.id, s)));
    return map;
  }, [categories]);

  const handleDeleteNode = useCallback(
    (id: string) => {
      const target = nodes.find((n) => n.id === id);
      if (!target || isDropZoneNode(target)) return;

      const dropChildren = edges
        .filter((e) => e.source === id)
        .map((e) => nodes.find((n) => n.id === e.target))
        .filter((n) => n && isDropZoneNode(n))
        .map((n) => n!.id);

      setNodes((prev) =>
        prev.filter((n) => n.id !== id && !dropChildren.includes(n.id))
      );

      setEdges((edgePrev) => {
        const incoming = edgePrev.filter((e) => e.target === id);
        const outgoing = edgePrev.filter((e) => e.source === id);
        const cleaned = edgePrev.filter(
          (e) =>
            e.source !== id &&
            e.target !== id &&
            !dropChildren.includes(e.source) &&
            !dropChildren.includes(e.target)
        );

        const bridges: Edge[] = [];
        for (const inn of incoming) {
          for (const out of outgoing) {
            const outTarget = nodes.find((n) => n.id === out.target);
            if (outTarget && isDropZoneNode(outTarget)) continue;
            const exists = cleaned.some(
              (e) => e.source === inn.source && e.target === out.target
            );
            if (!exists && inn.source !== out.target) {
              bridges.push(createWorkflowEdge(inn.source, out.target));
            }
          }
        }
        return [...cleaned, ...bridges];
      });

      if (selectedNodeId === id) onSelectNode(null);
    },
    [nodes, edges, setNodes, setEdges, selectedNodeId, onSelectNode]
  );

  const replaceDropZoneWithStep = useCallback(
    (
      dropZoneId: string,
      def: StepDefinition,
      day: number
    ) => {
      const dropZone = nodes.find((n) => n.id === dropZoneId);
      if (!dropZone || !isDropZoneNode(dropZone)) return;

      const incoming = edges.find((e) => e.target === dropZoneId);
      const sourceId = incoming?.source;
      const stepId = `node-${Date.now()}`;
      const stepNode = buildStepNode(stepId, def, dropZone.position, day);
      const nextDropId = createDropZoneId();
      const nextDrop = buildDropZoneNode(
        nextDropId,
        dropZonePositionBelow(stepNode)
      );

      setNodes((prev) => [
        ...prev.filter((n) => n.id !== dropZoneId),
        stepNode,
        nextDrop,
      ]);

      setEdges((prev) => {
        const without = prev.filter((e) => e.target !== dropZoneId);
        const next = [...without, createWorkflowEdge(stepId, nextDropId)];
        if (sourceId) {
          return [
            ...next.filter((e) => !(e.source === sourceId && e.target === stepId)),
            createWorkflowEdge(sourceId, stepId),
          ];
        }
        return next;
      });

      onSelectNode(stepId);
    },
    [nodes, edges, setNodes, setEdges, onSelectNode]
  );

  const handleInsertBetween = useCallback(
    (sourceId: string, targetId: string) => {
      const source = nodes.find((n) => n.id === sourceId);
      const target = nodes.find((n) => n.id === targetId);
      if (!source || !target || !isStepNode(source)) return;

      if (isDropZoneNode(target)) {
        return;
      }

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
        return [
          ...without,
          createWorkflowEdge(sourceId, id),
          createWorkflowEdge(id, targetId),
        ];
      });

      onSelectNode(id);
    },
    [nodes, stepById, setNodes, setEdges, onSelectNode]
  );

  const handleAddParallelFlow = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const target = nodes.find((n) => n.id === edge.target);
      if (!target || !isDropZoneNode(target)) return;

      if (countDropZoneChildren(edge.source, nodes, edges) > 1) return;

      const [leftPos, rightPos] = parallelDropPositions(target.position);
      const leftId = createDropZoneId();
      const rightId = createDropZoneId();

      setNodes((prev) => [
        ...prev.filter((n) => n.id !== target.id),
        buildDropZoneNode(leftId, leftPos),
        buildDropZoneNode(rightId, rightPos),
      ]);

      setEdges((prev) => [
        ...prev.filter((e) => e.id !== edgeId),
        createWorkflowEdge(edge.source, leftId),
        createWorkflowEdge(edge.source, rightId),
      ]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  const handleRemoveConnector = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const target = nodes.find((n) => n.id === edge.target);

      setEdges((prev) => prev.filter((e) => e.id !== edgeId));

      if (target && isDropZoneNode(target)) {
        setNodes((prev) => prev.filter((n) => n.id !== target.id));
      }
    },
    [edges, nodes, setEdges, setNodes]
  );

  const handleAddTitle = useCallback(
    (edgeId: string) => {
      const current = edges.find((e) => e.id === edgeId);
      const existing =
        typeof current?.data === "object" && current.data
          ? (current.data as { title?: string }).title
          : "";
      const title = window.prompt("Connector title", existing ?? "");
      if (title === null) return;

      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? {
                ...e,
                data: {
                  ...(typeof e.data === "object" ? e.data : {}),
                  title: title.trim() || undefined,
                },
              }
            : e
        )
      );
    },
    [edges, setEdges]
  );

  const handleConnectorAction = useCallback(
    (
      edgeId: string,
      action: ConnectorMenuAction,
      sourceId: string,
      targetId: string
    ) => {
      switch (action) {
        case "addParallelFlow":
          handleAddParallelFlow(edgeId);
          break;
        case "addStep":
          handleInsertBetween(sourceId, targetId);
          break;
        case "removeConnector":
          handleRemoveConnector(edgeId);
          break;
        case "addTitle":
          handleAddTitle(edgeId);
          break;
        default:
          break;
      }
    },
    [
      handleAddParallelFlow,
      handleInsertBetween,
      handleRemoveConnector,
      handleAddTitle,
    ]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const target = nodes.find((n) => n.id === connection.target);
      if (target && isDropZoneNode(target)) return;
      setEdges((eds) =>
        addEdge(createWorkflowEdge(connection.source!, connection.target!), eds)
      );
    },
    [setEdges, nodes]
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

      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const hitDropZone = findDropZoneAtPosition(nodes, flowPosition);

      if (hitDropZone) {
        const incoming = edges.find((ed) => ed.target === hitDropZone.id);
        const day = incoming
          ? dayAfterSource(nodes, incoming.source)
          : 1;
        replaceDropZoneWithStep(hitDropZone.id, def, day);
        return;
      }

      const stepOnly = onlyStepNodes(nodes);
      const isFirstNode = stepOnly.length === 0;
      const id = `node-${Date.now()}`;

      let position: { x: number; y: number };
      let day = 1;
      let lastNodeId: string | null = null;

      if (isFirstNode) {
        position = flowPosition;
      } else {
        const sortedByY = [...stepOnly].sort(
          (a, b) => b.position.y - a.position.y
        );
        const lastNode = sortedByY[0] as Node<WorkflowNodeData>;
        position = {
          x: lastNode.position.x,
          y: lastNode.position.y + NODE_VERTICAL_SPACING,
        };
        day = lastNode.data.day + 1;
        lastNodeId = lastNode.id;
      }

      const newNode = buildStepNode(id, def, position, day);
      const dropId = createDropZoneId();
      const dropNode = buildDropZoneNode(dropId, dropZonePositionBelow(newNode));

      setNodes((prev) => [...prev, newNode, dropNode]);

      setEdges((prev) => {
        const next = [...prev, createWorkflowEdge(id, dropId)];
        if (lastNodeId) {
          return [...next, createWorkflowEdge(lastNodeId, id)];
        }
        return next;
      });

      onSelectNode(id);
    },
    [
      screenToFlowPosition,
      stepById,
      nodes,
      edges,
      setNodes,
      setEdges,
      onSelectNode,
      replaceDropZoneWithStep,
    ]
  );

  const handleNodeClick: NodeMouseHandler<Node<WorkflowCanvasNodeData>> =
    useCallback(
      (_e, node) => {
        if (isDropZoneNode(node)) {
          onSelectNode(null);
          return;
        }
        onSelectNode(node.id);
      },
      [onSelectNode]
    );

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  const enhancedNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (isDropZoneNode(n)) {
          return { ...n, selected: false };
        }
        return {
          ...n,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            onDelete: handleDeleteNode,
          },
        };
      }),
    [nodes, selectedNodeId, handleDeleteNode]
  );

  const enhancedEdges = useMemo(
    () =>
      edges.map((e) => {
        const targetNode = nodes.find((n) => n.id === e.target);
        const targetIsDropZone = targetNode ? isDropZoneNode(targetNode) : false;
        const showParallelFlow =
          targetIsDropZone &&
          countDropZoneChildren(e.source, nodes, edges) === 1;

        return {
          ...e,
          type: WORKFLOW_EDGE_TYPE,
          style: {
            stroke: WORKFLOW_CONNECTOR_COLOR,
            strokeWidth: WORKFLOW_CONNECTOR_STROKE_WIDTH,
          },
          data: {
            ...(typeof e.data === "object" ? e.data : {}),
            targetIsDropZone,
            showParallelFlow,
            onConnectorAction: handleConnectorAction,
          },
        };
      }),
    [edges, nodes, handleConnectorAction]
  );

  const hasStepNodes = onlyStepNodes(nodes).length > 0;

  return (
    <div
      className="workflow-builder-flow relative h-full flex-1 overflow-hidden"
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
        nodesDraggable
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

      {!hasStepNodes ? (
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
