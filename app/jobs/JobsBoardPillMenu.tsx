"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type JobsBoardPillOption = { value: string; label: string };

export const jobsBoardPillTriggerClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#e2e8f0)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_28%,transparent)] motion-reduce:transition-none";

const jobsBoardPillTriggerActiveClass =
  "border-[color:color-mix(in_srgb,var(--brand-primary)_35%,#e2e8f0)] font-medium text-[color:var(--brand-primary)]";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 text-slate-500 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readBrandStyleFromNode(node: HTMLElement | null): CSSProperties {
  let current: HTMLElement | null = node;
  while (current) {
    const primary = current.style.getPropertyValue("--brand-primary");
    if (primary) {
      return { "--brand-primary": primary } as CSSProperties;
    }
    current = current.parentElement;
  }
  return {};
}

function computeMenuPosition(
  trigger: HTMLElement,
  align: "start" | "end",
  optionCount: number
): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 6;
  const preferredMaxHeight = 240;
  const estimatedHeight = Math.min(optionCount * 42 + 8, preferredMaxHeight);
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
  const spaceAbove = rect.top - viewportPadding;
  const openBelow = spaceBelow >= estimatedHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(
    preferredMaxHeight,
    openBelow ? spaceBelow : spaceAbove
  );
  const top = openBelow
    ? rect.bottom + gap
    : Math.max(viewportPadding, rect.top - gap - maxHeight);
  const width = rect.width;
  const left = align === "end" ? rect.right - width : rect.left;

  return { top, left, width, maxHeight };
}

export function JobsBoardPillMenu({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder,
  variant = "compact",
  align = "end",
  className = "",
}: {
  value: string;
  options: JobsBoardPillOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  variant?: "compact" | "field";
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [menuBrandStyle, setMenuBrandStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const displayLabel = selected && value ? selected.label : placeholder;
  const hasValue = Boolean(value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setMenuPosition(computeMenuPosition(trigger, align, options.length));
    setMenuBrandStyle(readBrandStyleFromNode(trigger));
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [align, open, options.length]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const triggerClass =
    variant === "field"
      ? `${jobsBoardPillTriggerClass} w-full min-w-0 rounded-xl`
      : `${jobsBoardPillTriggerClass} min-w-[9.5rem] shrink-0`;

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        style={{
          ...menuBrandStyle,
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
          maxHeight: menuPosition.maxHeight,
          zIndex: 80,
          pointerEvents: "auto",
        }}
        className="pointer-events-auto overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value || "__empty__"}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center border-0 px-3.5 py-2.5 text-left text-sm outline-none transition motion-reduce:transition-none ${
                active
                  ? "bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] font-medium text-[color:var(--brand-primary)]"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className={className}>
      <button
        ref={triggerRef}
        type="button"
        className={`${triggerClass} ${hasValue ? jobsBoardPillTriggerActiveClass : ""}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon open={open} />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
