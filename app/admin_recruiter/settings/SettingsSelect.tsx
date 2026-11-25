"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

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
  /** Show a search field inside the menu to filter options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  placeholder?: string;
  /**
   * Fixed accent for selected/focus styles (e.g. Launch Pad navy `#012352`).
   * When set, tenant `--brand-secondary` is ignored.
   */
  accentHex?: string;
};

const MENU_MAX_HEIGHT = 280;
const DEFAULT_ACCENT = "#012352";

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
  searchable = false,
  searchPlaceholder = "Search...",
  placeholder = "Select",
  accentHex,
}: SettingsSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [brandSecondary, setBrandSecondary] = useState(accentHex?.trim() || DEFAULT_ACCENT);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const label = displayLabel ?? selected?.label ?? "";
  const fixedAccent = accentHex?.trim() || "";

  const resolveBrandSecondary = useCallback(() => {
    if (fixedAccent) {
      setBrandSecondary(fixedAccent);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const valueFromTrigger = getComputedStyle(trigger).getPropertyValue("--brand-secondary").trim();
    if (valueFromTrigger) {
      setBrandSecondary(valueFromTrigger);
      return;
    }
    const valueFromRoot = getComputedStyle(document.documentElement)
      .getPropertyValue("--brand-secondary")
      .trim();
    if (valueFromRoot) setBrandSecondary(valueFromRoot);
  }, [fixedAccent]);

  const filteredOptions = useMemo(() => {
    if (!searchable) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query, searchable]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 160);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const preferUp = dropUp || (spaceBelow < 160 && spaceAbove > spaceBelow);
    const maxHeight = Math.max(
      140,
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
    resolveBrandSecondary();
  }, [resolveBrandSecondary]);

  useLayoutEffect(() => {
    if (!open) return;
    resolveBrandSecondary();
    updatePosition();
  }, [open, updatePosition, filteredOptions.length, searchable, resolveBrandSecondary]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, searchable]);

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

  useEffect(() => {
    if (!open) return;
    const onWheel = (event: WheelEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const target = event.target as Node | null;
      if (!target || (target !== menu && !menu.contains(target))) return;
      const scrollable = menu.querySelector("[data-settings-select-scroll]") as HTMLElement | null;
      if (!scrollable) return;
      scrollable.scrollTop += event.deltaY;
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
          <div
            ref={menuRef}
            style={
              {
                ...menuStyle,
                overscrollBehavior: "contain",
                // Portaled to body — copy tenant brand token so selected styles resolve.
                ["--brand-secondary" as string]: brandSecondary,
              } as CSSProperties
            }
            className="pointer-events-auto z-[300] flex flex-col overflow-hidden rounded-[8px] border border-[#CBD5E1] bg-white shadow-lg"
          >
            {searchable ? (
              <div className="shrink-0 border-b border-[#F1F5F9] p-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]"
                    aria-hidden
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="h-9 w-full rounded-[8px] border border-[#E2E8F0] bg-white py-0 pl-8 pr-3 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[color:var(--brand-secondary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-secondary)_16%,transparent)]"
                  />
                </div>
              </div>
            ) : null}

            <ul
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              data-settings-select-scroll
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-[#94A3B8]">No options</li>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected =
                    Boolean(value) && option.value === value && !displayLabel;
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
                        style={
                          isSelected
                            ? {
                                color: brandSecondary,
                                backgroundColor: `color-mix(in srgb, ${brandSecondary} 12%, white)`,
                                borderLeftColor: brandSecondary,
                              }
                            : undefined
                        }
                        className={`flex w-full cursor-pointer border-l-2 px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                          isSelected
                            ? "border-l-current font-semibold"
                            : "border-l-transparent text-[#0F172A] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {option.label}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`relative ${className ?? ""}`}
      style={
        fixedAccent
          ? ({ ["--brand-secondary" as string]: fixedAccent } as CSSProperties)
          : undefined
      }
    >
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
        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] border border-[#CBD5E1] bg-white px-3 pr-3 text-left font-normal text-[#0F172A] outline-none transition hover:border-[#94A3B8] focus-visible:border-[color:var(--brand-secondary,#012352)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary,#012352)_16%,transparent)] disabled:cursor-not-allowed disabled:bg-[#F1F5F9] disabled:opacity-70 ${heightClass} ${triggerClassName ?? ""}`}
      >
        <span className={`min-w-0 flex-1 truncate ${label ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
          {label || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
      </button>
      {menu}
    </div>
  );
}
