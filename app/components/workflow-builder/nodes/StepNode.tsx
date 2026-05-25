"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import { STEP_COLORS, GOLD } from "../constants";
import type { WorkflowNodeData } from "../types";

type StepNodeType = Node<WorkflowNodeData>;

export default function StepNode(props: NodeProps<StepNodeType>) {
  const { data, id, selected } = props;
  const color = STEP_COLORS[data.color];

  const onDelete = data.onDelete;
  const onAddNext = data.onAddNext;

  return (
    <div className="relative">
      <div
        className="w-[230px] overflow-hidden rounded-xl bg-white shadow-sm transition"
        style={{
          border: selected ? `2px solid ${GOLD}` : `1px solid #eaecf0`,
          boxShadow: selected
            ? "0 4px 16px rgba(188, 139, 65, 0.18)"
            : "0 1px 3px rgba(16, 24, 40, 0.08)",
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: color.ring,
            width: 8,
            height: 8,
            border: "2px solid white",
          }}
        />

        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: color.header, color: color.text }}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/20">
            {data.icon}
          </span>
          <span className="flex-1 truncate text-sm font-semibold leading-5">
            {data.label}
          </span>

          {selected && onDelete ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/40"
              aria-label="Delete step"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 text-xs">
          <span className="font-medium" style={{ color: "#101828" }}>
            Day {data.day}
          </span>
          {data.required ? (
            <>
              <span style={{ color: "#d0d5dd" }}>•</span>
              <span className="font-medium" style={{ color: "#DC2626" }}>
                Required
              </span>
            </>
          ) : null}
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: color.ring,
            width: 8,
            height: 8,
            border: "2px solid white",
          }}
        />
      </div>

      {onAddNext ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddNext(id);
          }}
          className="absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#012352] text-white shadow-md transition hover:brightness-110"
          aria-label="Add next step"
        >
          <Plus size={12} />
        </button>
      ) : null}
    </div>
  );
}
