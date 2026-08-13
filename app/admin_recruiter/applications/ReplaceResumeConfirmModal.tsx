"use client";

import { useEffect } from "react";
import { Loader2, Upload } from "lucide-react";

type ReplaceResumeConfirmModalProps = {
  open: boolean;
  fileName: string;
  busy?: boolean;
  hasExistingResume?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReplaceResumeConfirmModal({
  open,
  fileName,
  busy = false,
  hasExistingResume = true,
  onCancel,
  onConfirm,
}: ReplaceResumeConfirmModalProps) {
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

  if (!open || !fileName) return null;

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
        aria-labelledby="replace-resume-title"
        className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF]">
            <Upload className="h-5 w-5 text-[#2563EB]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="replace-resume-title" className="text-lg font-semibold text-[#101828]">
              {hasExistingResume ? "Re-upload resume?" : "Upload resume?"}
            </h3>
            <p className="mt-2 text-sm leading-5 text-[#475569]">
              {hasExistingResume
                ? "This file will be added to resume history for this job. Previous uploads stay saved. The newest resume becomes the one shown on the candidate profile and may update the job match score."
                : "Uploading this file will attach a resume to this candidate for this job and may update their candidate information and job match score."}
            </p>
            <p className="mt-3 truncate rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#0F172A]">
              {fileName}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#012352] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : hasExistingResume ? (
              "Re-upload Resume"
            ) : (
              "Upload Resume"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
