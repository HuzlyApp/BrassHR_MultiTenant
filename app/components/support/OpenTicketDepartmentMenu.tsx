"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SUPPORT_DEPARTMENTS } from "@/lib/support-tickets/support-departments";

type Props = {
  onSelectDepartment: (category: string) => void;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  label?: string;
};

export function OpenTicketDepartmentMenu({
  onSelectDepartment,
  buttonClassName,
  buttonStyle,
  label = "Open a Ticket",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className={
          buttonClassName ??
          "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold leading-4 text-white transition hover:brightness-95"
        }
        style={buttonStyle}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Select a department"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,280px)] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1.5 shadow-lg"
        >
          {SUPPORT_DEPARTMENTS.map((dept) => (
            <button
              key={dept.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelectDepartment(dept.category);
              }}
              className="flex w-full flex-col items-start px-3.5 py-2.5 text-left transition hover:bg-[#F8FAFC]"
            >
              <span className="text-sm font-medium text-[#0F172A]">{dept.title}</span>
              <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#64748B]">
                {dept.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
