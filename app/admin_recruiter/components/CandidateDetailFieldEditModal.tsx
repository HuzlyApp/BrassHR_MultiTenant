"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

type CandidateDetailFieldEditModalProps = {
  open: boolean;
  title: string;
  busy?: boolean;
  error?: string | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
};

/**
 * Mobile/tablet edit sheet for Applicant Details fields.
 * Desktop keeps inline editors — this modal is only mounted from compact viewports.
 */
export default function CandidateDetailFieldEditModal({
  open,
  title,
  busy = false,
  error = null,
  saveLabel = "Save",
  onClose,
  onSave,
  children,
}: CandidateDetailFieldEditModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-70 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_18px_38px_rgba(2,8,23,0.2)] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] px-5 py-4 sm:px-6">
          <h2 className="min-w-0 truncate text-lg font-semibold text-[#1F2937] sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:opacity-60"
            aria-label={`Close ${title}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[#E5E7EB] px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] px-4 text-sm font-semibold text-[#374151] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
