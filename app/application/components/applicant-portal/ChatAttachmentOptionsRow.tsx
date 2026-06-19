"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Download, Eye, MoreVertical } from "lucide-react";

const MENU_WIDTH = 136;

type Props = {
  fileName: string;
  isApplicant: boolean;
  isImage: boolean;
  hasImageAbove?: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onView: () => void;
  onDownload: () => void;
};

export function ChatAttachmentOptionsRow({
  fileName,
  isApplicant,
  isImage,
  hasImageAbove = false,
  isOpen,
  onOpen,
  onClose,
  onView,
  onDownload,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - MENU_WIDTH),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const menu =
    isOpen && menuPosition ? (
      <div
        ref={menuRef}
        style={{ position: "fixed", top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
        className={`min-w-[136px] overflow-hidden rounded-lg border shadow-lg ${
          isApplicant
            ? "border-white/20 bg-[#0F172A] text-white"
            : "border-[#E2E8F0] bg-white text-[#0F2F62]"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onClose();
            onView();
          }}
          className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium ${
            isApplicant ? "hover:bg-white/10" : "hover:bg-[#F8FAFC]"
          }`}
        >
          <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {isImage ? "View" : "Open"}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onDownload();
          }}
          className={`flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-[13px] font-medium ${
            isApplicant ? "border-white/10 hover:bg-white/10" : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
          }`}
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Download
        </button>
      </div>
    ) : null;

  return (
    <>
      <div
        className={`relative flex min-w-[140px] items-center gap-2 px-3 py-2 text-xs font-medium ${
          hasImageAbove ? (isApplicant ? "border-t border-white/20" : "border-t border-[#E2E8F0]") : ""
        }`}
      >
        <p className="min-w-0 flex-1 truncate pr-1">{fileName}</p>
        <button
          ref={buttonRef}
          type="button"
          aria-label="File options"
          aria-expanded={isOpen}
          onClick={(event) => {
            event.stopPropagation();
            if (isOpen) {
              onClose();
              return;
            }
            if (buttonRef.current) onOpen();
          }}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
            isApplicant ? "text-white hover:bg-white/15" : "text-[#64748B] hover:bg-[#F1F5F9]"
          }`}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </>
  );
}
