"use client";

import { useEffect } from "react";

type ClaimCandidatesConfirmModalProps = {
  open: boolean;
  selectedCount: number;
  eligibleCount: number;
  excludedCount: number;
  recruiterName: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClaimCandidatesConfirmModal({
  open,
  selectedCount,
  eligibleCount,
  excludedCount,
  recruiterName,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ClaimCandidatesConfirmModalProps) {
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

  if (!open || selectedCount <= 0) return null;

  const claimVerb = eligibleCount === 1 ? "Claim Candidate" : "Claim Candidates";

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
        aria-labelledby="claim-candidates-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="claim-candidates-title" className="text-lg font-semibold text-[#101828]">
          Claim {selectedCount} selected candidate{selectedCount === 1 ? "" : "s"}?
        </h3>
        <p className="mt-2 text-sm leading-5 text-[#475569]">
          You ({recruiterName}) will be assigned as the recruiter for{" "}
          <span className="font-semibold text-[#101828]">
            {eligibleCount} eligible candidate{eligibleCount === 1 ? "" : "s"}
          </span>
          .
          {excludedCount > 0 ? (
            <>
              {" "}
              {excludedCount} candidate{excludedCount === 1 ? " is" : "s are"} already claimed or
              ineligible and will be skipped.
            </>
          ) : null}
        </p>
        <p className="mt-2 text-sm leading-5 text-[#64748B]">
          Already-claimed candidates will not be overwritten.
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
            disabled={busy || eligibleCount === 0}
            onClick={onConfirm}
            className="rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Claiming…" : claimVerb}
          </button>
        </div>
      </div>
    </div>
  );
}
