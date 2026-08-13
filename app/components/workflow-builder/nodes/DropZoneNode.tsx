"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import {
  DROP_ZONE_HEIGHT,
  DROP_ZONE_WIDTH,
  GOLD,
  NAVY,
  TEXT_MUTED,
} from "../constants";
import type { DropZoneNodeData } from "../types";

type DropZoneNodeType = Node<DropZoneNodeData>;

export default function DropZoneNode({ data, selected }: NodeProps<DropZoneNodeType>) {
  const highlighted = data.highlighted === true;
  const libraryDragActive = data.libraryDragActive === true;

  return (
    <div
      className="flex items-center justify-center rounded-md border-2 border-dashed transition"
      style={{
        width: DROP_ZONE_WIDTH,
        height: DROP_ZONE_HEIGHT,
        borderColor: highlighted ? GOLD : selected ? NAVY : "#cbd5e1",
        backgroundColor: highlighted ? "#faf6ef" : "#f1f5f9",
        boxShadow: highlighted ? "0 0 0 4px rgba(188, 139, 65, 0.18)" : undefined,
        cursor: libraryDragActive ? "copy" : "pointer",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          border: "2px solid white",
          background: NAVY,
        }}
      />
      <span
        className="px-3 text-center text-[11px] font-semibold leading-4"
        style={{ color: highlighted ? GOLD : TEXT_MUTED }}
      >
        {highlighted || libraryDragActive ? "Drop here" : "Drag steps here"}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          border: "2px solid white",
          background: NAVY,
          opacity: 0,
        }}
      />
    </div>
  );
}
