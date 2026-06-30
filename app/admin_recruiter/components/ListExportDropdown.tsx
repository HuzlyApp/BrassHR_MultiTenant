"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download } from "lucide-react";
import { CANDIDATES_PAGE_SUBTITLE_STYLE } from "../candidates/candidates-typography";

type ListExportDropdownProps = {
  onExportCsv: () => void;
  onExportXls: () => void;
  variant?: "toolbar" | "icon";
  disabled?: boolean;
};

function ExportMenu({
  menuId,
  style,
  onExportCsv,
  onExportXls,
  onClose,
}: {
  menuId: string;
  style: CSSProperties;
  onExportCsv: () => void;
  onExportXls: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      id={menuId}
      role="menu"
      style={style}
      className="z-[200] min-w-[168px] overflow-visible rounded-md border border-[#dce6e3] bg-white py-1 shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExportCsv();
          onClose();
        }}
        className="flex w-full items-center whitespace-nowrap px-3 py-2.5 text-left text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
        style={CANDIDATES_PAGE_SUBTITLE_STYLE}
      >
        Download CSV
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExportXls();
          onClose();
        }}
        className="flex w-full items-center whitespace-nowrap px-3 py-2.5 text-left text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
        style={CANDIDATES_PAGE_SUBTITLE_STYLE}
      >
        Download XLS
      </button>
    </div>,
    document.body
  );
}

export function ListExportDropdown({
  onExportCsv,
  onExportXls,
  variant = "toolbar",
  disabled = false,
}: ListExportDropdownProps) {
  const autoId = useId();
  const menuId = `${autoId}-export-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 168),
    });
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
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(target)) return;
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
  }, [open, menuId]);

  const triggerClass =
    variant === "icon"
      ? "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

  const triggerContent: ReactNode =
    variant === "icon" ? (
      <Download className="h-4 w-4" />
    ) : (
      <>
        <Download className="h-4 w-4 shrink-0" />
        <span>Export</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </>
    );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-label="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Export"
        className={triggerClass}
        style={variant === "toolbar" ? CANDIDATES_PAGE_SUBTITLE_STYLE : undefined}
      >
        {triggerContent}
      </button>
      {open && menuStyle && typeof document !== "undefined" ? (
        <ExportMenu
          menuId={menuId}
          style={menuStyle}
          onExportCsv={onExportCsv}
          onExportXls={onExportXls}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
