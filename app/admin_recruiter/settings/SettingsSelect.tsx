"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type SettingsSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SettingsSelectProps = {
  id?: string;
  value: string;
  options: SettingsSelectOption[];
  onChange: (value: string) => void;
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Keep showing this label instead of the selected option (action menus like Add Existing). */
  displayLabel?: string;
  dropUp?: boolean;
  size?: "sm" | "md";
};

const MENU_MAX_HEIGHT = 240;

export default function SettingsSelect({
  id,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  disabled = false,
  className,
  triggerClassName,
  displayLabel,
  dropUp = false,
  size = "md",
}: SettingsSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const label = displayLabel ?? selected?.label ?? "";

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 140);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferUp = dropUp || (spaceBelow < 140 && spaceAbove > spaceBelow);
    const maxHeight = Math.max(
      120,
      Math.min(MENU_MAX_HEIGHT, preferUp ? spaceAbove : spaceBelow)
    );
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    if (preferUp) {
      setMenuStyle({
        position: "fixed",
        left,
        width,
        maxHeight,
        bottom: window.innerHeight - rect.top + 4,
        top: "auto",
        visibility: "visible",
        pointerEvents: "auto",
      });
      return;
    }

    setMenuStyle({
      position: "fixed",
      left,
      width,
      maxHeight,
      top: rect.bottom + 4,
      bottom: "auto",
      visibility: "visible",
      pointerEvents: "auto",
    });
  }, [dropUp]);

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
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Radix Dialog scroll-lock cancels wheel outside Dialog.Content.
  // Handle wheel in capture and scroll the portaled menu manually.
  useEffect(() => {
    if (!open) return;
    const onWheel = (event: WheelEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const target = event.target as Node | null;
      if (!target || (target !== menu && !menu.contains(target))) return;
      menu.scrollTop += event.deltaY;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => document.removeEventListener("wheel", onWheel, { capture: true });
  }, [open]);

  const heightClass = size === "sm" ? "h-8 text-xs" : "h-10 text-sm";

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            style={{ ...menuStyle, overscrollBehavior: "contain" }}
            className="pointer-events-auto z-[300] overflow-y-auto overscroll-contain rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-[#94A3B8]">No options</li>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value && !displayLabel;
                return (
                  <li key={option.value || "__empty"} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onClick={() => {
                        if (option.disabled) return;
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={`flex w-full px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                        isSelected
                          ? "bg-[#DBEAFE] font-medium text-[#0F172A]"
                          : "text-[#0F172A] hover:bg-[#EFF6FF]"
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 text-left font-normal text-[#0F172A] outline-none transition hover:border-[#CBD5E1] focus-visible:border-[#012352] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,#012352_16%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:opacity-70 ${heightClass} ${triggerClassName ?? ""}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
