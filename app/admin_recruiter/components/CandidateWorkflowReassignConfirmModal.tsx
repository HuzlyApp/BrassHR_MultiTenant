"use client";

import { useEffect } from "react";

type CandidateWorkflowReassignConfirmModalProps = {
  open: boolean;
  previousWorkflowName: string | null;
  nextWorkflowName: string | null;
  busy?: boolean;
  onNo: () => void;
  onYes: () => void;
};

export function CandidateWorkflowReassignConfirmModal({
  open,
  previousWorkflowName,
  nextWorkflowName,
  busy = false,
  onNo,
  onYes,
}: CandidateWorkflowReassignConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onNo();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, busy, onNo]);

  if (!open) return null;

  const previousName = previousWorkflowName?.trim() || "current workflow";
  const nextName = nextWorkflowName?.trim() || "new workflow";

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={() => {
        if (!busy) onNo();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-workflow-reassign-title"
        className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="candidate-workflow-reassign-title"
          className="text-lg font-semibold text-[#101828]"
        >
          Update assigned workflow?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          This candidate&apos;s assigned workflow will change from{" "}
          <span className="font-semibold text-[#101828]">{previousName}</span> to{" "}
          <span className="font-semibold text-[#101828]">{nextName}</span>.
        </p>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          Matching completed and in-progress Pre-Hire and Post-Hire steps keep their status. New
          steps from the selected workflow show as not started.
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={onNo}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-4 text-sm font-medium text-[color:var(--brand-secondary)] disabled:opacity-50"
          >
            No
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onYes}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Updating..." : "Yes, update workflow"}
          </button>
        </div>
      </div>
    </div>
  );
}
