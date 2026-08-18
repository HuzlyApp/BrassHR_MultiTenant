"use client";

import { useEffect } from "react";

type RemoveFromJobConfirmModalProps = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveFromJobConfirmModal({
  open,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: RemoveFromJobConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-from-job-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="remove-from-job-title" className="text-lg font-semibold text-[#101828]">
          Remove from job?
        </h3>
        <p className="mt-2 text-sm leading-5 text-[#475569]">
          Are you sure want to remove this applicant for this job ??
        </p>
        {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Removing…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
