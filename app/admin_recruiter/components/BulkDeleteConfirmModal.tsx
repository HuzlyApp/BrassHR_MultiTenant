"use client";

import { useEffect, useState } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

export type BulkDeleteEntity = "job" | "candidate";

type BulkDeleteConfirmModalProps = {
  open: boolean;
  entity: BulkDeleteEntity;
  count: number;
  busy?: boolean;
  error?: string | null;
  /** When set, the user must type this exact string before Delete is enabled. */
  requireConfirmationText?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

function entityLabel(entity: BulkDeleteEntity, count: number): string {
  if (entity === "job") return count === 1 ? "job" : "jobs";
  return count === 1 ? "candidate" : "candidates";
}

export function BulkDeleteConfirmModal({
  open,
  entity,
  count,
  busy = false,
  error = null,
  requireConfirmationText,
  onCancel,
  onConfirm,
}: BulkDeleteConfirmModalProps) {
  const [confirmationInput, setConfirmationInput] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationInput("");
      return;
    }
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

  if (!open || count <= 0) return null;

  const label = entityLabel(entity, count);
  const title =
    entity === "job"
      ? count === 1
        ? "Delete job?"
        : "Delete jobs?"
      : count === 1
        ? "Delete candidate?"
        : "Delete candidates?";
  const confirmationMatches =
    !requireConfirmationText || confirmationInput === requireConfirmationText;

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
        aria-labelledby="bulk-delete-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2]">
            <BrandedSvgIcon
              src="/icons/delete-icon.svg"
              className="h-5 w-5"
              color="#DC2626"
            />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="bulk-delete-title" className="text-lg font-semibold text-[#101828]">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-5 text-[#475569]">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-[#101828]">
                {count} selected {label}
              </span>
              ? This action cannot be undone.
            </p>
            {entity === "job" ? (
              <p className="mt-2 text-sm leading-5 text-[#64748B]">
                All candidates linked to {count === 1 ? "this job" : "these jobs"} will also be removed.
              </p>
            ) : null}
            {requireConfirmationText ? (
              <div className="mt-4">
                <label htmlFor="bulk-delete-confirmation" className="text-sm leading-5 text-[#475569]">
                  Type{" "}
                  <span className="font-mono font-semibold text-[#101828]">{requireConfirmationText}</span>{" "}
                  to confirm
                </label>
                <input
                  id="bulk-delete-confirmation"
                  type="text"
                  value={confirmationInput}
                  onChange={(event) => setConfirmationInput(event.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={`Type ${requireConfirmationText} to confirm deletion`}
                  placeholder={requireConfirmationText}
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-normal leading-6 text-[#334155] outline-none focus:border-[#DC2626]"
                />
              </div>
            ) : null}
            {error ? <p className="mt-3 text-sm text-[#DC2626]">{error}</p> : null}
          </div>
        </div>

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
            disabled={busy || !confirmationMatches}
            onClick={onConfirm}
            className="rounded-lg bg-[#DC2626] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
