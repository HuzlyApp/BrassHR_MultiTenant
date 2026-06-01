"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Plus, X } from "lucide-react";

import {
  WORKFLOW_CONNECTOR_COLOR,
  WORKFLOW_CONNECTOR_STROKE_WIDTH,
} from "../constants";

export type WorkflowConnectorEdgeData = {
  removeMode?: boolean;
  onEnterRemoveMode?: (edgeId: string) => void;
  onExitRemoveMode?: () => void;
  onInsertBetween?: (sourceId: string, targetId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
};

const CENTER_BUTTON_CLASS =
  "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition hover:brightness-110";

export default function WorkflowConnectorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = (data ?? {}) as WorkflowConnectorEdgeData;
  const removeMode = edgeData.removeMode === true;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const enterRemoveMode = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    edgeData.onEnterRemoveMode?.(id);
  };

  return (
    <>
      {/* Wide hit area so right-click works on the line, not only the + button */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        onContextMenu={enterRemoveMode}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: WORKFLOW_CONNECTOR_COLOR,
          strokeWidth: WORKFLOW_CONNECTOR_STROKE_WIDTH,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onContextMenu={enterRemoveMode}
        >
          {removeMode && edgeData.onDeleteEdge ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                edgeData.onDeleteEdge?.(id);
                edgeData.onExitRemoveMode?.();
              }}
              className={CENTER_BUTTON_CLASS}
              style={{ backgroundColor: WORKFLOW_CONNECTOR_COLOR }}
              aria-label="Remove connection"
              title="Remove line"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          ) : edgeData.onInsertBetween ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                edgeData.onInsertBetween?.(source, target);
              }}
              className={CENTER_BUTTON_CLASS}
              style={{ backgroundColor: WORKFLOW_CONNECTOR_COLOR }}
              aria-label="Add step between"
              title="Add step"
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
