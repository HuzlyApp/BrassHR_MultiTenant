"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  allowedJobStatusTransitions,
  normalizeJobRequisitionStatus,
} from "@/lib/jobs/job-status";
import type { JobStatus } from "@/lib/jobs/types";
import { JOB_STATUSES } from "@/lib/jobs/types";
import { JOB_FORM_SURFACE_CLASS } from "./job-form-shared";
import {
  jobDetailsStatusDotClass,
  jobDetailsStatusLabel,
} from "./job-details-helpers";

type Props = {
  status: string;
  busy?: boolean;
  disabled?: boolean;
  onSelect: (next: JobStatus) => void;
};

export function JobListStatusDropdown({
  status,
  busy = false,
  disabled = false,
  onSelect,
}: Props) {
  const current = normalizeJobRequisitionStatus(status);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const options = JOB_STATUSES.filter(
    (value) => value === current || allowedJobStatusTransitions(current).includes(value)
  );

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const menuHeight = Math.min(280, options.length * 36 + 8);
      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuHeight - 4);
      }
      setMenuStyle({
        position: "fixed",
        top,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 180)),
        minWidth: Math.max(rect.width, 148),
        visibility: "visible",
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="flex justify-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || busy}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={`inline-flex h-8 w-fit items-center justify-center gap-2 whitespace-nowrap px-2.5 text-sm text-[#334155] outline-none transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60 ${JOB_FORM_SURFACE_CLASS}`}
        aria-label={`Job status: ${jobDetailsStatusLabel(current)}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${jobDetailsStatusDotClass(current)}`}
          aria-hidden
        />
        <span>{jobDetailsStatusLabel(current)}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label="Job status"
              style={menuStyle}
              className="z-[200] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              {options.map((value) => {
                const selected = value === current;
                return (
                  <button
                    key={value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-60 ${
                      selected ? "bg-[#EFF6FF]" : ""
                    }`}
                    onClick={() => {
                      setOpen(false);
                      if (value !== current) onSelect(value);
                    }}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${jobDetailsStatusDotClass(value)}`}
                      aria-hidden
                    />
                    {jobDetailsStatusLabel(value)}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
