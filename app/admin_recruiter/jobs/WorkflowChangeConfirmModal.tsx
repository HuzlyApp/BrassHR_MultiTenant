"use client";

import { useEffect } from "react";

export type WorkflowChangeConfirmDetails = {
  applicantCount: number;
  previousWorkflowName: string | null;
  nextWorkflowName: string | null;
};

type WorkflowChangeConfirmModalProps = {
  open: boolean;
  details: WorkflowChangeConfirmDetails | null;
  busy?: boolean;
  onCancel: () => void;
  onKeepExisting: () => void;
  onUpdateExisting: () => void;
};

export function WorkflowChangeConfirmModal({
  open,
  details,
  busy = false,
  onCancel,
  onKeepExisting,
  onUpdateExisting,
}: WorkflowChangeConfirmModalProps) {
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

  if (!open || !details || details.applicantCount <= 0) return null;

  const previousName = details.previousWorkflowName?.trim() || "previous workflow";
  const nextName = details.nextWorkflowName?.trim() || "new workflow";
  const countLabel =
    details.applicantCount === 1
      ? "1 existing applicant"
      : `${details.applicantCount} existing applicants`;

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
        aria-labelledby="workflow-change-title"
        className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="workflow-change-title" className="text-lg font-semibold text-[#101828]">
          Update workflow for existing applicants?
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          This job&apos;s assigned workflow is changing from{" "}
          <span className="font-semibold text-[#101828]">{previousName}</span> to{" "}
          <span className="font-semibold text-[#101828]">{nextName}</span>.
        </p>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          {countLabel} still use the previous workflow. If you choose{" "}
          <span className="font-medium text-[#101828]">Yes</span>, their Pre-Hire and Post-Hire
          steps will be updated to the new workflow. Matching completed and in-progress steps keep
          their status; new steps show as not started.
        </p>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          Choose <span className="font-medium text-[#101828]">No</span> to update the job only.
          Existing applicants keep their current steps; only new applicants get the new workflow.
        </p>

        <div className="mt-6 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-4 text-sm font-medium text-[color:var(--brand-secondary)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onKeepExisting}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-4 text-sm font-medium text-[color:var(--brand-secondary)] disabled:opacity-50"
            >
              No, only new applicants
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onUpdateExisting}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Updating..." : "Yes, update existing applicants"}
          </button>
        </div>
      </div>
    </div>
  );
}
