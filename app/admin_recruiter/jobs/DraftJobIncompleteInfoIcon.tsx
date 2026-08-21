"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export const DRAFT_JOB_INCOMPLETE_TOOLTIP =
  "Complete required fields to publish this job.";

export function DraftJobIncompleteInfoIcon() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 280;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    setPosition({ top: rect.bottom + 8, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EF4444] text-[11px] font-bold leading-none text-white transition hover:brightness-95"
        aria-label="Incomplete job posting"
        aria-expanded={open}
        aria-describedby={open ? "draft-job-incomplete-tooltip" : undefined}
      >
        i
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id="draft-job-incomplete-tooltip"
              role="tooltip"
              style={{ position: "fixed", top: position.top, left: position.left, zIndex: 200 }}
              className="w-[280px] rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-left text-xs leading-5 text-[#475569] shadow-lg"
            >
              {DRAFT_JOB_INCOMPLETE_TOOLTIP}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
