"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

const PRIMARY_MENU_WIDTH = 200;
const SUBMENU_WIDTH = 200;
const PRIMARY_MENU_ESTIMATED_HEIGHT = 180;
const SUBMENU_ESTIMATED_HEIGHT = 220;

export type CandidateRowActionsHandlers = {
  onReanalyze: () => void;
  onUpdateResume: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onMessage: () => void;
  onCall: () => void;
  onSetupInterview: () => void;
  onDeleteCandidate: () => void;
  onMarkAsHired: () => void;
};

type CandidateRowActionsMenuProps = {
  anchor: HTMLElement;
  onClose: () => void;
  analyzing?: boolean;
  hired?: boolean;
  archived?: boolean;
  resumeUploading?: boolean;
} & CandidateRowActionsHandlers;

function menuItemClassName(opts?: { highlight?: boolean; active?: boolean }) {
  const base =
    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition";
  if (opts?.highlight) {
    return `${base} font-medium text-[#2563EB] hover:bg-[#EFF6FF]`;
  }
  if (opts?.active) {
    return `${base} bg-[#F1F5F9] text-[#0F172A]`;
  }
  return `${base} text-[#334155] hover:bg-[#F8FAFC]`;
}

export function CandidateRowActionsMenu({
  anchor,
  onClose,
  analyzing = false,
  hired = false,
  archived = false,
  resumeUploading = false,
  onReanalyze,
  onUpdateResume,
  onArchive,
  onUnarchive,
  onMessage,
  onCall,
  onSetupInterview,
  onDeleteCandidate,
  onMarkAsHired,
}: CandidateRowActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const moreItemRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [submenuStyle, setSubmenuStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const [moreOpen, setMoreOpen] = useState(false);

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + PRIMARY_MENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - PRIMARY_MENU_ESTIMATED_HEIGHT - 4);
    }
    const left = Math.max(8, Math.min(rect.right - PRIMARY_MENU_WIDTH, window.innerWidth - PRIMARY_MENU_WIDTH - 8));
    setStyle({
      position: "fixed",
      top,
      left,
      width: PRIMARY_MENU_WIDTH,
      visibility: "visible",
    });
  }, [anchor]);

  const updateSubmenuPosition = useCallback(() => {
    const moreEl = moreItemRef.current;
    if (!moreEl) return;
    const rect = moreEl.getBoundingClientRect();
    let left = rect.right + 4;
    if (left + SUBMENU_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, rect.left - SUBMENU_WIDTH - 4);
    }
    let top = rect.top;
    if (top + SUBMENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - SUBMENU_ESTIMATED_HEIGHT - 8);
    }
    setSubmenuStyle({
      position: "fixed",
      top,
      left,
      width: SUBMENU_WIDTH,
      visibility: "visible",
    });
  }, []);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!moreOpen) return;
    updateSubmenuPosition();
  }, [moreOpen, updateSubmenuPosition]);

  useEffect(() => {
    const onReposition = () => {
      updatePosition();
      if (moreOpen) updateSubmenuPosition();
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [moreOpen, updatePosition, updateSubmenuPosition]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (moreOpen) {
        setMoreOpen(false);
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchor, moreOpen, onClose]);

  if (typeof document === "undefined") return null;

  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Candidate actions"
        style={style}
        className="z-[200] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
      >
        <button
          type="button"
          role="menuitem"
          disabled={analyzing}
          onClick={() => runAndClose(onReanalyze)}
          className={`${menuItemClassName()} disabled:opacity-50`}
        >
          Reanalyze
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={resumeUploading}
          onClick={() => runAndClose(onUpdateResume)}
          className={`${menuItemClassName()} disabled:opacity-50`}
        >
          Update Resume
        </button>
        {archived ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onUnarchive)}
            className={menuItemClassName()}
          >
            Unarchive
          </button>
        ) : (
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onArchive)}
            className={menuItemClassName()}
          >
            Archive
          </button>
        )}
        <button
          ref={moreItemRef}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          onMouseEnter={() => setMoreOpen(true)}
          className={menuItemClassName({ active: moreOpen })}
        >
          <span>More Action</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden />
        </button>
      </div>

      {moreOpen ? (
        <div
          ref={submenuRef}
          role="menu"
          aria-label="More candidate actions"
          style={submenuStyle}
          className="z-[210] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onMessage)}
            className={menuItemClassName()}
          >
            Message
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onCall)}
            className={menuItemClassName()}
          >
            Call
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onSetupInterview)}
            className={menuItemClassName()}
          >
            Set up interview
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAndClose(onDeleteCandidate)}
            className={menuItemClassName()}
          >
            Delete candidate
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={hired}
            onClick={() => runAndClose(onMarkAsHired)}
            className={`${menuItemClassName({ highlight: true })} disabled:opacity-50`}
          >
            Mark as hired
          </button>
        </div>
      ) : null}
    </>,
    document.body
  );
}
