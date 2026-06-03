"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

import {
  DROP_ZONE_HEIGHT,
  DROP_ZONE_WIDTH,
  NAVY,
  TEXT_MUTED,
} from "../constants";
import type { DropZoneNodeData } from "../types";

type DropZoneNodeType = Node<DropZoneNodeData>;

export default function DropZoneNode({ selected }: NodeProps<DropZoneNodeType>) {
  return (
    <div
      className="flex items-center justify-center rounded-md border-2 border-dashed transition"
      style={{
        width: DROP_ZONE_WIDTH,
        height: DROP_ZONE_HEIGHT,
        borderColor: selected ? NAVY : "#cbd5e1",
        backgroundColor: "#f1f5f9",
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
        style={{ color: TEXT_MUTED }}
      >
        Drag steps here
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
