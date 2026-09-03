"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

const MENU_MAX_HEIGHT = 240;
const MENU_MIN_WIDTH = 180;

type ScrollableFilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  ariaLabel: string;
  className?: string;
  /** Trigger width; menu grows to fit long labels. */
  triggerClassName?: string;
};

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
      <path
        d="M4 6.5L8 10.5L12 6.5"
        stroke="#94A3B8"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Toolbar filter that opens a scrollable menu below the trigger
 * (native &lt;select&gt; cannot force direction or max-height reliably).
 */
export function ScrollableFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
  className = "",
  triggerClassName = "w-[150px]",
}: ScrollableFilterSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const display = options.find((option) => option.value === value)?.label ?? placeholder;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, spaceBelow));
    const width = Math.max(MENU_MIN_WIDTH, rect.width);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left,
      width,
      maxHeight,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, options.length]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
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

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
            className="z-[200] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
          >
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`flex w-full px-3 py-2 text-left text-xs leading-4 transition hover:bg-[#F8FAFC] ${
                !value ? "bg-[#F1F5F9] font-medium text-[#0F172A]" : "text-[#64748B]"
              }`}
            >
              {placeholder}
            </button>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-xs leading-4 transition hover:bg-[#F8FAFC] ${
                    selected ? "bg-[#F1F5F9] font-medium text-[#0F172A]" : "text-[#334155]"
                  }`}
                  title={option.label}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative shrink-0 ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-8 shrink-0 items-center gap-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white pl-3.5 pr-2 text-left transition hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none ${triggerClassName}`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-xs font-normal leading-4 ${
            value ? "text-[#374151]" : "text-[#64748B]"
          }`}
        >
          {display}
        </span>
        <ChevronDownIcon />
      </button>
      {menu}
    </div>
  );
}
