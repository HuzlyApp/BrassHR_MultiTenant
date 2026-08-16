"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

const SURFACE =
  "box-border inline-flex h-8 min-h-8 min-w-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-center text-sm leading-none tabular-nums text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";

const PAGE_SIZE_SELECT_BOX_CLASS =
  "relative inline-flex h-8 min-w-[3.5rem] items-center justify-center rounded-lg border border-[#CBD5E1] bg-white transition hover:bg-[#F8FAFC] focus-within:border-[#CBD5E1]";

const PAGE_SIZE_SELECT_TRIGGER_CLASS =
  "flex h-8 w-full min-w-[3.5rem] cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-6 text-center text-sm leading-none tabular-nums text-[#334155] outline-none focus:outline-none focus:ring-0";

const PAGE_SIZE_SELECT_MENU_CLASS =
  "z-[200] overflow-hidden rounded-lg border border-[#CBD5E1] bg-white p-0 shadow-md";

const PAGE_SIZE_SELECT_OPTION_CLASS =
  "flex w-full cursor-pointer items-center justify-center px-3 py-1.5 text-sm text-[#334155] hover:bg-[#F1F5F9]";

/** Approximate menu height for 3 options — used to flip above trigger near page bottom. */
const PAGE_SIZE_MENU_ESTIMATED_HEIGHT = 120;
const PAGE_SIZE_MENU_GAP = 4;

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Active page background — branding secondary. */
  activeStyle?: CSSProperties;
  className?: string;
};

const MAX_VISIBLE_PAGES = 7;

/** Build a compact page list: all pages when few, else window + ellipsis. */
function getVisiblePageItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= MAX_VISIBLE_PAGES) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    items.push("ellipsis");
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page);
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis");
  }

  items.push(totalPages);
  return items;
}

/**
 * List pagination: fixed equal height, 8px radius.
 * Page numbers are generated from totalPages; active page uses branding secondary.
 */
export function ListPaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  activeStyle,
  className = "",
}: Props) {
  const branding = useTenantBranding();
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotal);
  const pageItems = getVisiblePageItems(safePage, safeTotal);
  const resolvedActiveStyle: CSSProperties = activeStyle ?? {
    backgroundColor: branding.secondaryHex,
    borderColor: branding.secondaryHex,
  };

  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, safePage - 1))}
        disabled={safePage <= 1}
        className={`${SURFACE} gap-1 px-2.5`}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden min-[480px]:inline">Previous</span>
      </button>

      {pageItems.map((item, index) => {
        if (item === "ellipsis") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="inline-flex h-8 min-w-8 items-center justify-center text-sm text-[#94A3B8]"
              aria-hidden
            >
              …
            </span>
          );
        }

        const active = item === safePage;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            className={`${SURFACE} min-w-8 px-0 ${
              active ? "border-transparent text-white hover:opacity-95" : ""
            }`}
            style={active ? resolvedActiveStyle : undefined}
            aria-current={active ? "page" : undefined}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(safeTotal, safePage + 1))}
        disabled={safePage >= safeTotal}
        className={`${SURFACE} gap-1 px-2.5`}
      >
        <span className="hidden min-[480px]:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ListPaginationShowLabel({
  pageSize,
  options,
  onPageSizeChange,
  selectClassName,
}: {
  pageSize: number;
  options: number[];
  onPageSizeChange: (size: number) => void;
  selectClassName?: string;
}): ReactNode {
  const branding = useTenantBranding();
  const activeOptionStyle: CSSProperties = {
    backgroundColor: branding.secondaryHex,
    color: "#FFFFFF",
  };
  const listboxId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 56);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < PAGE_SIZE_MENU_ESTIMATED_HEIGHT + PAGE_SIZE_MENU_GAP;

    setMenuStyle(
      openUpward
        ? {
            position: "fixed",
            bottom: window.innerHeight - rect.top + PAGE_SIZE_MENU_GAP,
            left: rect.left,
            width,
            visibility: "visible",
          }
        : {
            position: "fixed",
            top: rect.bottom + PAGE_SIZE_MENU_GAP,
            left: rect.left,
            width,
            visibility: "visible",
          }
    );
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <label className="flex shrink-0 items-center gap-2 text-sm text-[#64748B]">
      Show
      <span ref={rootRef} className={selectClassName ?? PAGE_SIZE_SELECT_BOX_CLASS}>
        <button
          ref={triggerRef}
          type="button"
          className={PAGE_SIZE_SELECT_TRIGGER_CLASS}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((value) => !value)}
        >
          {pageSize}
        </button>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#94A3B8]"
          strokeWidth={2}
          aria-hidden
        />
        {open && menuStyle && typeof document !== "undefined"
          ? createPortal(
              <ul
                ref={menuRef}
                id={listboxId}
                role="listbox"
                aria-label="Results per page"
                style={menuStyle}
                className={`${PAGE_SIZE_SELECT_MENU_CLASS} list-none`}
              >
                {options.map((size) => {
                  const active = size === pageSize;
                  return (
                    <li key={size} role="option" aria-selected={active} className="m-0 p-0">
                      <button
                        type="button"
                        className={
                          active
                            ? "flex w-full cursor-pointer items-center justify-center px-3 py-1.5 text-sm text-white hover:opacity-95"
                            : PAGE_SIZE_SELECT_OPTION_CLASS
                        }
                        style={active ? activeOptionStyle : undefined}
                        onClick={() => {
                          onPageSizeChange(size);
                          setOpen(false);
                        }}
                      >
                        {size}
                      </button>
                    </li>
                  );
                })}
              </ul>,
              document.body
            )
          : null}
      </span>
    </label>
  );
}
