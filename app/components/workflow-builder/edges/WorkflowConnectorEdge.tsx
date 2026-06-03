"use client";

import { useRef, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Plus } from "lucide-react";

import ConnectorActionMenu, {
  type ConnectorMenuAction,
} from "../ConnectorActionMenu";
import ConnectorMenuPortal from "../ConnectorMenuPortal";
import {
  WORKFLOW_CONNECTOR_COLOR,
  WORKFLOW_CONNECTOR_STROKE_WIDTH,
} from "../constants";

export type WorkflowConnectorEdgeData = {
  title?: string;
  targetIsDropZone?: boolean;
  showParallelFlow?: boolean;
  onConnectorAction?: (
    edgeId: string,
    action: ConnectorMenuAction,
    sourceId: string,
    targetId: string
  ) => void;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleAction = (action: ConnectorMenuAction) => {
    edgeData.onConnectorAction?.(id, action, source, target);
  };

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: WORKFLOW_CONNECTOR_COLOR,
          strokeWidth: WORKFLOW_CONNECTOR_STROKE_WIDTH,
        }}
      />
      {edgeData.title ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none rounded bg-white/90 px-2 py-0.5 text-[10px] font-semibold shadow-sm"
            style={{
              position: "absolute",
              transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 18}px)`,
              color: WORKFLOW_CONNECTOR_COLOR,
            }}
          >
            {edgeData.title}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {edgeData.onConnectorAction ? (
        <>
          <EdgeLabelRenderer>
            <div
              className="nodrag nopan pointer-events-auto"
              style={{
                position: "absolute",
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                zIndex: 1000,
              }}
            >
              <button
                ref={buttonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setMenuOpen((v) => !v);
                }}
                className={CENTER_BUTTON_CLASS}
                style={{ backgroundColor: WORKFLOW_CONNECTOR_COLOR }}
                aria-label="Connector actions"
                aria-expanded={menuOpen}
                title="Add or change flow"
              >
                <Plus size={12} strokeWidth={2.5} />
              </button>
            </div>
          </EdgeLabelRenderer>
          <ConnectorMenuPortal open={menuOpen} anchorRef={buttonRef}>
            <ConnectorActionMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              onSelect={handleAction}
              anchorEl={buttonRef.current}
              showParallelFlow={
                edgeData.showParallelFlow !== false &&
                edgeData.targetIsDropZone === true
              }
            />
          </ConnectorMenuPortal>
        </>
      ) : null}
    </>
  );
}
