"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GOLD } from "../constants";
import type { WorkflowNodeData } from "../types";

type StepNodeType = Node<WorkflowNodeData>;

export default function StepNode(props: NodeProps<StepNodeType>) {
  const { data, id, selected } = props;
  const iconHostRef = useRef<HTMLSpanElement>(null);
  const [iconBgColor, setIconBgColor] = useState<string>("#eaecf0");

  const onDelete = data.onDelete;
  const onAddNext = data.onAddNext;

  useEffect(() => {
    const host = iconHostRef.current;
    if (!host) return;

    const iconRoot = host.firstElementChild as HTMLElement | null;
    if (!iconRoot) return;

    const nodesToInspect: HTMLElement[] = [iconRoot, ...(Array.from(iconRoot.children) as HTMLElement[])];
    for (const el of nodesToInspect) {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        setIconBgColor(bg);
        return;
      }
    }
  }, [data.icon]);

  return (
    <div className="relative">
      <div
        className="h-[70px] w-[232px] min-h-[46px] min-w-[100px] overflow-hidden rounded-md bg-white transition"
        style={{
          border: `1px solid ${selected ? GOLD : iconBgColor}`,
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{
            // background: color.ring,
            width: 8,
            height: 8,
            border: "2px solid white",
          }}
        />

        <div className="flex h-full flex-col gap-2 p-2">
          <div className="flex items-center gap-2">
            <span
              ref={iconHostRef}
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-md [&>svg]:h-[18px] [&>svg]:w-[18px]"
            >
            {data.icon}
            </span>
            <span className="flex-1 whitespace-normal break-words text-black text-[11px] font-semibold leading-[14px]">
              {data.label}
            </span>

            {selected && onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove step"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>

          <div
            className="flex items-center gap-1.5"
            style={{
              fontFamily: "Inter, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "10px",
              lineHeight: "15px",
              letterSpacing: "0",
            }}
          >
            <span style={{ color: "#101828" }}>
              Day {data.day}
            </span>
            {data.required ? (
              <>
                <span style={{ color: "#d0d5dd" }}>•</span>
                <span style={{ color: "#DC2626" }}>
                  Required
                </span>
              </>
            ) : null}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            // background: color.ring,
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
