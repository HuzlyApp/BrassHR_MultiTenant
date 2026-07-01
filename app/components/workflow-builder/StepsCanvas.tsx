"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
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
import {
  isUploadResumeWorkflowStepId,
} from "@/lib/onboarding/enforce-upload-resume-first";

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
  onBeforeChange?: () => void;
  readOnly?: boolean;
  canPasteWorkflow?: boolean;
  pastingWorkflow?: boolean;
  onPasteWorkflow?: () => void;
  /** Tablet/mobile layout (narrow viewport). */
  compactMode?: boolean;
  /** Touch screen (phone, iPad, etc.) — enables finger panning. */
  touchPan?: boolean;
};

const COMPACT_FIT_VIEW = {
  padding: 0.75,
  minZoom: 0.08,
  maxZoom: 0.9,
} as const;

function MobileCanvasFitView({
  enabled,
  stepCount,
}: {
  enabled: boolean;
  stepCount: number;
}) {
  const { fitView } = useReactFlow();
  const lastFitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || stepCount === 0) return;

    const fitKey = `${enabled}:${stepCount}`;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;

    const frame = requestAnimationFrame(() => {
      void fitView({ ...COMPACT_FIT_VIEW, duration: 0 });
    });

    return () => cancelAnimationFrame(frame);
  }, [enabled, stepCount, fitView]);

  return null;
}

const TOUCH_PAN_THRESHOLD = 6;

function isInteractiveTouchTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    "button, a, input, textarea, select, [contenteditable='true'], .nodrag, .nopan, .react-flow__controls"
  );
}

function MobileTouchPan({
  containerRef,
  enabled,
  onTapSelect,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  onTapSelect?: (nodeId: string | null) => void;
}) {
  const { getViewport, setViewport, screenToFlowPosition, getNodes } = useReactFlow();

  useEffect(() => {
    const root = containerRef.current;
    if (!enabled || !root) return;

    let activeTouch: { x: number; y: number; id: number } | null = null;
    let moved = false;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        activeTouch = null;
        return;
      }
      if (isInteractiveTouchTarget(event.target)) return;

      const touch = event.touches[0];
      activeTouch = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
      moved = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!activeTouch || event.touches.length !== 1) return;

      const touch = Array.from(event.touches).find((t) => t.identifier === activeTouch?.id);
      if (!touch) return;

      const dx = touch.clientX - activeTouch.x;
      const dy = touch.clientY - activeTouch.y;

      if (!moved && Math.hypot(dx, dy) < TOUCH_PAN_THRESHOLD) return;

      moved = true;
      event.preventDefault();
      event.stopPropagation();

      const viewport = getViewport();
      setViewport({
        x: viewport.x + dx,
        y: viewport.y + dy,
        zoom: viewport.zoom,
      });

      activeTouch = { x: touch.clientX, y: touch.clientY, id: touch.identifier };
    };

    const finishTouch = (event: TouchEvent) => {
      if (!activeTouch) return;

      if (!moved && onTapSelect) {
        const touch = Array.from(event.changedTouches).find(
          (t) => t.identifier === activeTouch?.id
        );
        if (touch && !isInteractiveTouchTarget(event.target)) {
          const flowPoint = screenToFlowPosition({
            x: touch.clientX,
            y: touch.clientY,
          });
          const hit = getNodes().find((node) => {
            if (node.type !== "step") return false;
            const width = node.measured?.width ?? node.width ?? 232;
            const height = node.measured?.height ?? node.height ?? 70;
            return (
              flowPoint.x >= node.position.x &&
              flowPoint.x <= node.position.x + width &&
              flowPoint.y >= node.position.y &&
              flowPoint.y <= node.position.y + height
            );
          });
          onTapSelect(hit?.id ?? null);
        }
      }

      activeTouch = null;
      moved = false;
    };

    root.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    root.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    root.addEventListener("touchend", finishTouch, { capture: true, passive: true });
    root.addEventListener("touchcancel", finishTouch, { capture: true, passive: true });

    return () => {
      root.removeEventListener("touchstart", onTouchStart, { capture: true });
      root.removeEventListener("touchmove", onTouchMove, { capture: true });
      root.removeEventListener("touchend", finishTouch, { capture: true });
      root.removeEventListener("touchcancel", finishTouch, { capture: true });
    };
  }, [containerRef, enabled, getViewport, setViewport, screenToFlowPosition, getNodes, onTapSelect]);

  return null;
}

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
  onBeforeChange,
  readOnly = false,
  canPasteWorkflow = false,
  pastingWorkflow = false,
  onPasteWorkflow,
  compactMode = false,
  touchPan = false,
}: StepsCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const useTouchCanvas = compactMode || touchPan;
  const { screenToFlowPosition } = useReactFlow<
    Node<WorkflowCanvasNodeData>,
    Edge
  >();
  const dragHistoryRecorded = useRef(false);

  const stepById = useMemo(() => {
    const map = new Map<string, StepDefinition>();
    categories.forEach((c) => c.steps.forEach((s) => map.set(s.id, s)));
    return map;
  }, [categories]);

  const handleDeleteNode = useCallback(
    (id: string) => {
      if (readOnly) return;
      const target = nodes.find((n) => n.id === id);
      if (!target || isDropZoneNode(target)) return;
      if (
        isStepNode(target) &&
        (target.data.lockedFirstStep === true || isUploadResumeWorkflowStepId(target.data.stepId))
      ) {
        return;
      }

      onBeforeChange?.();

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
    [nodes, edges, setNodes, setEdges, selectedNodeId, onSelectNode, onBeforeChange, readOnly]
  );

  const replaceDropZoneWithStep = useCallback(
    (
      dropZoneId: string,
      def: StepDefinition,
      day: number
    ) => {
      const dropZone = nodes.find((n) => n.id === dropZoneId);
      if (!dropZone || !isDropZoneNode(dropZone)) return;
      if (readOnly) return;
      if (isUploadResumeWorkflowStepId(def.id)) {
        const hasResume = onlyStepNodes(nodes).some(
          (n) => isStepNode(n) && isUploadResumeWorkflowStepId(n.data.stepId)
        );
        if (hasResume) return;
      }

      onBeforeChange?.();

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
    [nodes, edges, setNodes, setEdges, onSelectNode, onBeforeChange, readOnly]
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

      onBeforeChange?.();

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
    [nodes, stepById, setNodes, setEdges, onSelectNode, onBeforeChange]
  );

  const handleAddParallelFlow = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const target = nodes.find((n) => n.id === edge.target);
      if (!target || !isDropZoneNode(target)) return;

      if (countDropZoneChildren(edge.source, nodes, edges) > 1) return;

      onBeforeChange?.();

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
    [nodes, edges, setNodes, setEdges, onBeforeChange]
  );

  const handleRemoveConnector = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;

      const target = nodes.find((n) => n.id === edge.target);

      onBeforeChange?.();

      setEdges((prev) => prev.filter((e) => e.id !== edgeId));

      if (target && isDropZoneNode(target)) {
        setNodes((prev) => prev.filter((n) => n.id !== target.id));
      }
    },
    [edges, nodes, setEdges, setNodes, onBeforeChange]
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

      onBeforeChange?.();

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
    [edges, setEdges, onBeforeChange]
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
      onBeforeChange?.();
      setEdges((eds) =>
        addEdge(createWorkflowEdge(connection.source!, connection.target!), eds)
      );
    },
    [setEdges, nodes, onBeforeChange]
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
      if (isUploadResumeWorkflowStepId(def.id)) {
        const hasResume = onlyStepNodes(nodes).some(
          (n) => isStepNode(n) && isUploadResumeWorkflowStepId(n.data.stepId)
        );
        if (hasResume) return;
      }

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

      onBeforeChange?.();

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
      onBeforeChange,
    ]
  );

  const handleNodeDragStart = useCallback(() => {
    if (dragHistoryRecorded.current) return;
    onBeforeChange?.();
    dragHistoryRecorded.current = true;
  }, [onBeforeChange]);

  const handleNodeDragStop = useCallback(() => {
    dragHistoryRecorded.current = false;
  }, []);

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
          return { ...n, selected: false, draggable: false };
        }
        return {
          ...n,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            onDelete:
              readOnly ||
              !isStepNode(n) ||
              n.data.lockedFirstStep === true ||
              isUploadResumeWorkflowStepId(n.data.stepId)
                ? undefined
                : handleDeleteNode,
          },
        };
      }),
    [nodes, selectedNodeId, handleDeleteNode, readOnly]
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
            showParallelFlow: readOnly ? false : showParallelFlow,
            onConnectorAction: readOnly ? undefined : handleConnectorAction,
          },
        };
      }),
    [edges, nodes, handleConnectorAction, readOnly]
  );

  const handleTouchTapSelect = useCallback(
    (nodeId: string | null) => {
      onSelectNode(nodeId);
    },
    [onSelectNode]
  );

  const stepNodes = onlyStepNodes(nodes);
  const hasStepNodes = stepNodes.length > 0;
  const fitViewOptions = compactMode ? COMPACT_FIT_VIEW : { padding: 0.3 };

  return (
    <div
      ref={canvasRef}
      className={`workflow-builder-flow relative h-full flex-1 overflow-hidden${useTouchCanvas ? " workflow-builder-flow--touch-pan" : ""}`}
      style={{ backgroundColor: "transparent" }}
      onDrop={readOnly ? undefined : onDrop}
      onDragOver={readOnly ? undefined : onDragOver}
    >
      <ReactFlow
        nodes={enhancedNodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeClick={handleNodeClick}
        onNodeDragStart={readOnly ? undefined : handleNodeDragStart}
        onNodeDragStop={readOnly ? undefined : handleNodeDragStop}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        edgesFocusable={!readOnly}
        edgesReconnectable={false}
        nodesDraggable={!readOnly && !useTouchCanvas}
        deleteKeyCode={null}
        onPaneContextMenu={(e) => e.preventDefault()}
        fitView={!compactMode}
        fitViewOptions={fitViewOptions}
        minZoom={useTouchCanvas ? 0.08 : 0.5}
        maxZoom={2}
        panOnDrag={!useTouchCanvas}
        panOnScroll={useTouchCanvas}
        panOnScrollMode={PanOnScrollMode.Free}
        selectNodesOnDrag={false}
        zoomOnPinch
        preventScrolling
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
        {useTouchCanvas ? (
          <MobileTouchPan
            containerRef={canvasRef}
            enabled={useTouchCanvas}
            onTapSelect={handleTouchTapSelect}
          />
        ) : null}
        {compactMode ? (
          <MobileCanvasFitView enabled={compactMode} stepCount={stepNodes.length} />
        ) : null}
      </ReactFlow>

      {!hasStepNodes ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-white/60 px-8 py-10 text-center"
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
            {!readOnly && canPasteWorkflow ? (
              <button
                type="button"
                onClick={onPasteWorkflow}
                disabled={pastingWorkflow}
                className="pointer-events-auto mt-2 flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "var(--brand-primary)" }}
              >
                {pastingWorkflow ? "Pasting…" : "Paste workflow"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
