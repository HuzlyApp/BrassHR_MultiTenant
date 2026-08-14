"use client";

import { useEffect } from "react";
import { Eye, Loader2, Trash2, Upload, X } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { MAX_RESUME_UPLOADS_PER_ROLE, resumeUploadLimitMessage } from "@/lib/resume/resume-upload-limit";

export type ResumeHistoryItem = {
  id: string;
  fileName: string;
  fileIconType?: "pdf" | "jpeg";
  uploadedAtLabel: string;
  uploadedByName: string;
  uploadedByPhotoUrl?: string | null;
  uploadedByType: "worker" | "staff" | "unknown";
};

type ResumeHistoryModalProps = {
  open: boolean;
  jobTitle: string;
  resumes: ResumeHistoryItem[];
  loading?: boolean;
  error?: string | null;
  busyResumeId?: string | null;
  reuploadBusy?: boolean;
  reuploadDisabled?: boolean;
  reuploadDisabledReason?: string | null;
  onClose: () => void;
  onReupload: () => void;
  onView: (resumeId: string) => void;
  onDelete: (resumeId: string, fileName: string) => void;
};

const INDEX_COL_CLASS = "w-8 shrink-0";
const ICON_COL_CLASS = "w-[1.8rem] shrink-0";
const ACTIONS_COL_CLASS = "flex w-[4.75rem] shrink-0 items-center justify-center gap-1";
const UPLOADER_COL_CLASS = "w-[7.5rem] shrink-0 min-w-0 text-right sm:w-[8.5rem]";

function uploaderRoleLabel(type: ResumeHistoryItem["uploadedByType"]): string {
  if (type === "staff") return "Admin";
  if (type === "worker") return "Worker";
  return "";
}

function UploaderCell({ resume }: { resume: ResumeHistoryItem }) {
  const roleLabel = uploaderRoleLabel(resume.uploadedByType);

  return (
    <div className={UPLOADER_COL_CLASS} title={resume.uploadedByName}>
      <p className="truncate text-sm font-medium leading-5 text-[#334155]">
        {resume.uploadedByName}
      </p>
      {roleLabel ? (
        <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#94A3B8]">{roleLabel}</p>
      ) : null}
    </div>
  );
}

function ResumeHistoryRow({
  resume,
  index,
  busy,
  onView,
  onDelete,
}: {
  resume: ResumeHistoryItem;
  index: number;
  busy: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const fileIconType = resume.fileIconType ?? "pdf";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-3 py-3 sm:gap-3 sm:px-4">
      <span
        className={`${INDEX_COL_CLASS} inline-flex h-8 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_12%,white)] text-xs font-semibold text-[color:var(--brand-primary)]`}
      >
        {index}
      </span>

      <BrandedFileTypeIcon type={fileIconType} className={`${ICON_COL_CLASS} h-[1.8rem] w-[1.8rem]`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[color:var(--brand-primary)]">
          {resume.fileName}
        </p>
        <p className="mt-1 text-xs text-[#64748B]">{resume.uploadedAtLabel}</p>
      </div>

      <div className={ACTIONS_COL_CLASS}>
        <button
          type="button"
          disabled={busy}
          onClick={onView}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] transition hover:bg-[#F8FAFC] disabled:opacity-50"
          aria-label={`View ${resume.fileName}`}
          title="View resume"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#DC2626] transition hover:bg-[#FEF2F2] disabled:opacity-50"
          aria-label={`Delete ${resume.fileName}`}
          title="Delete resume"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <UploaderCell resume={resume} />
    </div>
  );
}

export function ResumeHistoryModal({
  open,
  jobTitle,
  resumes,
  loading = false,
  error = null,
  busyResumeId = null,
  reuploadBusy = false,
  reuploadDisabled = false,
  reuploadDisabledReason = null,
  onClose,
  onReupload,
  onView,
  onDelete,
}: ResumeHistoryModalProps) {
  const modalBusy = reuploadBusy || Boolean(busyResumeId);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !modalBusy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, modalBusy, onClose]);

  if (!open) return null;

  const adminUploadCount = resumes.filter((resume) => resume.uploadedByType === "staff").length;
  const adminUploadLimitReached = adminUploadCount >= MAX_RESUME_UPLOADS_PER_ROLE;
  const limitMessage =
    reuploadDisabledReason ||
    (adminUploadLimitReached ? resumeUploadLimitMessage("admin") : null);

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={() => {
        if (!modalBusy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-history-title"
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-5 py-4">
          <div className="min-w-0">
            <h3 id="resume-history-title" className="text-lg font-semibold text-[#101828]">
              Resume history
            </h3>
            <p className="mt-1 truncate text-sm text-[#64748B]">{jobTitle}</p>
          </div>
          <button
            type="button"
            disabled={modalBusy}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F8FAFC] disabled:opacity-50"
            aria-label="Close resume history"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading resume history…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : resumes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-10 text-center text-sm text-[#64748B]">
              No resumes uploaded for this job yet.
            </p>
          ) : (
            <div>
              <div className="mb-3 flex items-center gap-3 px-3 sm:px-4">
                <span className={`${INDEX_COL_CLASS} inline-flex h-8`} aria-hidden />
                <span className={`${ICON_COL_CLASS} inline-flex h-[1.8rem]`} aria-hidden />
                <p className="min-w-0 flex-1 text-sm font-semibold text-[#334155]">Resumes</p>
                <span className={ACTIONS_COL_CLASS} aria-hidden />
                <p className={`${UPLOADER_COL_CLASS} text-sm font-semibold text-[#334155]`}>
                  Uploaded by
                </p>
              </div>
              <div className="space-y-3">
                {resumes.map((resume, index) => (
                  <ResumeHistoryRow
                    key={resume.id}
                    resume={resume}
                    index={index + 1}
                    busy={busyResumeId === resume.id}
                    onView={() => onView(resume.id)}
                    onDelete={() => onDelete(resume.id, resume.fileName)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E7EB] bg-white px-5 py-4">
          {limitMessage ? (
            <p className="mb-3 text-sm text-[#B91C1C]">{limitMessage}</p>
          ) : (
            <p className="mb-3 text-sm text-[#64748B]">
              {adminUploadCount} of {MAX_RESUME_UPLOADS_PER_ROLE} admin uploads used for this job.
            </p>
          )}
          <button
            type="button"
            disabled={reuploadBusy || reuploadDisabled || adminUploadLimitReached}
            onClick={onReupload}
            className="admin-recruiter-action-chip inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
          >
            {reuploadBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            <span>{reuploadBusy ? "Uploading…" : "Re-upload Resume"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
