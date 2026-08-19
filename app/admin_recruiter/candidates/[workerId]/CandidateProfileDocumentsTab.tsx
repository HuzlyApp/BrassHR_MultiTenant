"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Plus, ScanText, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { ReplaceResumeConfirmModal } from "@/app/admin_recruiter/applications/ReplaceResumeConfirmModal";
import type {
  CandidateProfileApplication,
  CandidateProfileDocument,
  CandidateProfileSubmittedResume,
} from "@/lib/admin/candidate-profile-view";
import {
  MAX_RESUME_UPLOADS_PER_ROLE,
  resumeUploadLimitMessage,
} from "@/lib/resume/resume-upload-limit";
import { validateResumeUploadFile } from "@/lib/resume/validate-resume-upload";
import { resumeIconType } from "./candidate-profile-ui";

const CARD_CLASS = "rounded-xl border border-[#E5E7EB] bg-white";
const SECTION_TITLE_CLASS =
  "text-lg font-semibold leading-7 text-[color:var(--brand-secondary)]";
const PRIMARY_BTN =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";
const OUTLINE_BTN =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-[color:var(--brand-primary)] px-3 text-xs font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-50";
const VIEW_BTN =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-[color:var(--brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";
const PARSE_BTN =
  "inline-flex h-9 cursor-pointer items-center justify-center gap-1 rounded-md border-2 border-[color:var(--brand-primary)] bg-white px-3 text-xs font-semibold text-[color:var(--brand-primary)] transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)] disabled:cursor-not-allowed disabled:opacity-50";
const DELETE_BTN =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-[#D1D5DB] px-3 text-xs font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50";
const TABLE_LINE = "border border-[#E5E7EB]";
const TABLE_HEADER_CLASS =
  `${TABLE_LINE} bg-[#F8FAFC] px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#64748B]`;
const TABLE_HEADER_RESUME_CLASS =
  `${TABLE_LINE} bg-[#F8FAFC] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]`;
const TABLE_CELL_CLASS = `${TABLE_LINE} px-3 py-3 align-middle`;
const TABLE_CELL_CENTER_CLASS = `${TABLE_CELL_CLASS} text-center`;
const SELECT_CLASS =
  "h-11 w-full cursor-pointer appearance-none rounded-lg border border-[#D1D5DB] bg-white bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pl-3 pr-10 text-sm text-[#334155] outline-none focus:border-[color:var(--brand-primary)]";
const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

/** The quota is per candidate across every job, so job name is not part of it. */
function adminUploadCount(resumes: CandidateProfileSubmittedResume[]): number {
  return resumes.filter((resume) => resume.uploadedByRoleLabel === "Admin").length;
}

function UploadResumeModal({
  open,
  jobs,
  resumes,
  uploading,
  error,
  onClose,
  onUpload,
}: {
  open: boolean;
  jobs: CandidateProfileApplication[];
  resumes: CandidateProfileSubmittedResume[];
  uploading: boolean;
  error: string | null;
  onClose: () => void;
  onUpload: (jobApplicationId: string, file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ job?: string; file?: string }>({});

  useEffect(() => {
    if (!open) {
      setSelectedJobId("");
      setSelectedFile(null);
      setFieldErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, uploading, onClose]);

  if (!open) return null;

  const uploadCount = adminUploadCount(resumes);
  const atLimit = uploadCount >= MAX_RESUME_UPLOADS_PER_ROLE;

  function handleSubmit() {
    const nextErrors: { job?: string; file?: string } = {};
    if (!selectedJobId) nextErrors.job = "Select a job.";
    if (!selectedFile) nextErrors.file = "Choose a resume file.";
    else {
      const validationError = validateResumeUploadFile({
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
      });
      if (validationError) nextErrors.file = validationError;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    if (!selectedFile) return;
    onUpload(selectedJobId, selectedFile);
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 px-4 py-8"
      role="presentation"
      onClick={() => {
        if (!uploading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-upload-resume-title"
        className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div className="min-w-0 pr-2">
            <h2 id="profile-upload-resume-title" className="text-lg font-semibold text-[#0F172A]">
              Upload Resume
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Select the job this resume is for, then choose the file. You can upload up to{" "}
              {MAX_RESUME_UPLOADS_PER_ROLE} resumes for this candidate in total.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F1F5F9]"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {atLimit ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {resumeUploadLimitMessage("admin")}
            </div>
          ) : null}

          {jobs.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              This candidate has not applied to any jobs yet. Add them to a job first, then upload a
              resume.
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="profile-resume-job" className="mb-2 block text-sm font-medium text-[#374151]">
                  Job
                </label>
                <select
                  id="profile-resume-job"
                  value={selectedJobId}
                  onChange={(event) => {
                    setSelectedJobId(event.target.value);
                    if (fieldErrors.job) setFieldErrors((current) => ({ ...current, job: undefined }));
                  }}
                  disabled={uploading || atLimit}
                  style={SELECT_CHEVRON}
                  className={`${SELECT_CLASS} ${fieldErrors.job ? "border-red-300" : ""} ${
                    !selectedJobId ? "text-[#94A3B8]" : ""
                  }`}
                >
                  <option value="">Select a job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.jobTitle}
                    </option>
                  ))}
                </select>
                {fieldErrors.job ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.job}</p>
                ) : (
                  <p className="mt-1 text-xs text-[#64748B]">
                    {uploadCount} of {MAX_RESUME_UPLOADS_PER_ROLE} admin uploads used.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#374151]">Resume file</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading || atLimit}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedFile(file);
                    if (fieldErrors.file) setFieldErrors((current) => ({ ...current, file: undefined }));
                  }}
                  className="block w-full cursor-pointer text-sm text-[#334155] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[color:var(--brand-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
                {fieldErrors.file ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.file}</p>
                ) : selectedFile ? (
                  <p className="mt-1 truncate text-xs text-[#64748B]">{selectedFile.name}</p>
                ) : null}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-5">
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-[#D1D5DB] px-4 text-sm font-medium text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={uploading || jobs.length === 0 || atLimit}
            onClick={handleSubmit}
            className={PRIMARY_BTN}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}

function uploadedByRoleDisplay(role: CandidateProfileSubmittedResume["uploadedByRoleLabel"]): string {
  if (role === "Admin") return "Admin Recruiter";
  if (role === "Worker") return "Worker";
  return "";
}

function ParsedBadge({ status }: { status: CandidateProfileSubmittedResume["parsingStatus"] }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--brand-secondary)] px-2.5 py-1 text-[11px] font-semibold text-white">
        <Check className="h-3 w-3" aria-hidden />
        Parsed
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4338CA]">
        Parsing…
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center rounded-md bg-[#FEF2F2] px-2.5 py-1 text-[11px] font-semibold text-[#B91C1C]">
        Parse failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
      Not parsed
    </span>
  );
}

function ResumeFileCell({
  resume,
  index,
}: {
  resume: CandidateProfileSubmittedResume;
  index: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] text-xs font-semibold text-[color:var(--brand-primary)]">
        {index}
      </span>
      <BrandedFileTypeIcon
        type={resumeIconType(resume.fileName, resume.fileType)}
        className="h-8 w-8 shrink-0"
      />
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold leading-5 text-[color:var(--brand-primary)]" title={resume.fileName}>
          {resume.fileName}
        </p>
        <p className="mt-0.5 text-xs text-[#64748B]">{resume.fileSizeLabel}</p>
        {resume.isReuploaded ? <ReuploadedBadge /> : null}
      </div>
    </div>
  );
}

function ReuploadedBadge() {
  return (
    <span className="mt-1 inline-flex items-center rounded-md bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
      Reuploaded
    </span>
  );
}

function ParseStatusCell({
  resume,
  busy,
  onParse,
}: {
  resume: CandidateProfileSubmittedResume;
  busy: boolean;
  onParse: () => void;
}) {
  const parsed = resume.parsingStatus === "completed";
  const parsing = resume.parsingStatus === "processing";

  if (parsed || parsing) {
    return <ParsedBadge status={resume.parsingStatus} />;
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={onParse}
      className={PARSE_BTN}
      title="Parse resume"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ScanText className="h-3.5 w-3.5" aria-hidden />}
      Parse
    </button>
  );
}

function UploadedByCell({ resume }: { resume: CandidateProfileSubmittedResume }) {
  const roleLabel = uploadedByRoleDisplay(resume.uploadedByRoleLabel);
  return (
    <div className="min-w-0" title={resume.uploadedByName}>
      <p className="truncate text-sm font-medium text-[#334155]">{resume.uploadedByName || "—"}</p>
      {roleLabel ? (
        <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#94A3B8]">{roleLabel}</p>
      ) : null}
    </div>
  );
}

function ResumeActions({
  busy,
  onView,
  onReupload,
  onDelete,
}: {
  busy: boolean;
  onView: () => void;
  onReupload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-nowrap items-center justify-start gap-2">
      <button type="button" disabled={busy} onClick={onView} className={VIEW_BTN}>
        View
      </button>
      <button
        type="button"
        disabled={busy}
        title="Replace this resume file"
        onClick={onReupload}
        className={OUTLINE_BTN}
      >
        Reupload
      </button>
      <button type="button" disabled={busy} onClick={onDelete} className={DELETE_BTN}>
        Delete
      </button>
    </div>
  );
}

type ResumeRowModel = {
  resume: CandidateProfileSubmittedResume;
  index: number;
  jobTitle: string;
  busy: boolean;
  onView: () => void;
  onReupload: () => void;
  onDelete: () => void;
  onParse: () => void;
};

function ResumeMobileCard(props: ResumeRowModel) {
  const { resume, index, jobTitle, busy, onParse } = props;
  return (
    <div className="space-y-3 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0">
      <ResumeFileCell resume={resume} index={index} />
      <div className="grid grid-cols-1 gap-3 pl-10 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Parse status</p>
          <div className="mt-1">
            <ParseStatusCell resume={resume} busy={busy} onParse={onParse} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            {resume.isReuploaded ? "Updated date" : "Uploaded date"}
          </p>
          <p className="mt-1 text-sm font-medium text-[#334155]">{resume.uploadedAtLabel}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Job name</p>
          <p className="mt-1 truncate text-sm font-semibold text-[color:var(--brand-secondary)]" title={jobTitle}>
            {jobTitle}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Uploaded by</p>
          <div className="mt-1">
            <UploadedByCell resume={resume} />
          </div>
        </div>
      </div>
      <div className="pl-10">
        <ResumeActions {...props} />
      </div>
    </div>
  );
}

function ResumeTableRow(props: ResumeRowModel) {
  const { resume, index, jobTitle, busy, onParse } = props;
  return (
    <tr>
      <td className={TABLE_CELL_CLASS}>
        <ResumeFileCell resume={resume} index={index} />
      </td>
      <td className={`${TABLE_CELL_CENTER_CLASS} whitespace-nowrap`}>
        <div className="flex justify-center">
          <ParseStatusCell resume={resume} busy={busy} onParse={onParse} />
        </div>
      </td>
      <td className={`${TABLE_CELL_CENTER_CLASS} whitespace-nowrap`}>
        <p className="text-sm font-medium leading-5 text-[#334155]">{resume.uploadedAtLabel}</p>
        {resume.isReuploaded ? (
          <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">Updated</p>
        ) : null}
      </td>
      <td className={TABLE_CELL_CENTER_CLASS}>
        <p className="truncate text-sm font-semibold text-[color:var(--brand-secondary)]" title={jobTitle}>
          {jobTitle}
        </p>
      </td>
      <td className={TABLE_CELL_CENTER_CLASS}>
        <UploadedByCell resume={resume} />
      </td>
      <td className={`${TABLE_CELL_CENTER_CLASS} whitespace-nowrap`}>
        <div className="flex justify-center">
          <ResumeActions {...props} />
        </div>
      </td>
    </tr>
  );
}

type CandidateProfileDocumentsTabProps = {
  workerId: string;
  applications: CandidateProfileApplication[];
  resumes: CandidateProfileSubmittedResume[];
  documents: CandidateProfileDocument[];
  onReload: () => Promise<void>;
};

export function CandidateProfileDocumentsTab({
  workerId,
  applications,
  resumes,
  documents,
  onReload,
}: CandidateProfileDocumentsTabProps) {
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyResumeId, setBusyResumeId] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    applicationId: string;
    file: File;
    /** Set when replacing an existing resume, which does not consume a new slot. */
    resumeId: string | null;
  } | null>(null);

  const otherDocuments = useMemo(
    () => documents.filter((doc) => doc.kind !== "resume"),
    [documents]
  );
  const fallbackApplicationId = applications[0]?.id ?? "";
  const adminUploadsUsed = adminUploadCount(resumes);
  const uploadLimitReached = adminUploadsUsed >= MAX_RESUME_UPLOADS_PER_ROLE;

  function applicationIdForResume(resume: CandidateProfileSubmittedResume): string {
    return resume.jobApplicationId?.trim() || fallbackApplicationId;
  }

  function jobTitleForResume(resume: CandidateProfileSubmittedResume): string {
    if (resume.jobTitle?.trim()) return resume.jobTitle.trim();
    const applicationId = resume.jobApplicationId?.trim();
    if (!applicationId) return "—";
    return applications.find((job) => job.id === applicationId)?.jobTitle?.trim() || "—";
  }

  async function uploadResume(applicationId: string, file: File, resumeId?: string | null) {
    setUploading(true);
    setUploadModalError(null);
    try {
      const form = new FormData();
      form.set("resume", file);
      if (resumeId) form.set("resumeId", resumeId);
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resume`,
        { method: "POST", body: form }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to upload resume");
      setUploadModalOpen(false);
      setPendingUpload(null);
      toast.success(resumeId ? "Resume reuploaded successfully." : "Resume uploaded successfully.");
      await onReload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to upload resume";
      setUploadModalError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function viewResume(resume: CandidateProfileSubmittedResume) {
    const applicationId = applicationIdForResume(resume);
    if (!applicationId) {
      toast.error("This resume is not linked to a job yet.");
      return;
    }
    setBusyResumeId(resume.id);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resume.id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      const url = payload.url?.trim() ?? "";
      if (!response.ok || !url) throw new Error(payload.error || "Could not open resume.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  async function deleteResume(resume: CandidateProfileSubmittedResume) {
    const applicationId = applicationIdForResume(resume);
    if (!applicationId) {
      toast.error("This resume is not linked to a job yet.");
      return;
    }
    if (!window.confirm(`Delete ${resume.fileName}? This cannot be undone.`)) return;
    setBusyResumeId(resume.id);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resume.id)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete resume.");
      toast.success("Resume deleted.");
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  async function parseResume(resume: CandidateProfileSubmittedResume) {
    const applicationId = applicationIdForResume(resume);
    if (!applicationId) {
      toast.error("This resume is not linked to a job yet.");
      return;
    }
    if (resume.parsingStatus === "completed") return;
    setBusyResumeId(resume.id);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resumes/${encodeURIComponent(resume.id)}/parse`,
        { method: "POST" }
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not parse resume.");
      toast.success("Resume parsed.");
      await onReload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not parse resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  function beginRowReupload(resume: CandidateProfileSubmittedResume) {
    const applicationId = applicationIdForResume(resume);
    if (!applicationId) {
      toast.error("This resume is not linked to a job yet.");
      return;
    }
    // Replacing a file never adds a resume, so it stays available at the limit.
    reuploadInputRef.current?.setAttribute("data-application-id", applicationId);
    reuploadInputRef.current?.setAttribute("data-resume-id", resume.id);
    window.requestAnimationFrame(() => reuploadInputRef.current?.click());
  }

  function handleReuploadFile(file: File | undefined) {
    const applicationId = reuploadInputRef.current?.getAttribute("data-application-id") || "";
    const resumeId = reuploadInputRef.current?.getAttribute("data-resume-id") || "";
    if (reuploadInputRef.current) reuploadInputRef.current.value = "";
    if (!file || !applicationId || !resumeId) return;
    const validationError = validateResumeUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setPendingUpload({ applicationId, file, resumeId });
  }

  function rowModelForResume(resume: CandidateProfileSubmittedResume, index: number): ResumeRowModel {
    return {
      resume,
      index: index + 1,
      jobTitle: jobTitleForResume(resume),
      busy: uploading || busyResumeId === resume.id,
      onView: () => void viewResume(resume),
      onReupload: () => beginRowReupload(resume),
      onDelete: () => void deleteResume(resume),
      onParse: () => void parseResume(resume),
    };
  }

  return (
    <div className="mt-5 space-y-4">
      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:px-5">
          <h2 className={SECTION_TITLE_CLASS}>Resume Submitted</h2>
          <button
            type="button"
            disabled={uploading || uploadLimitReached}
            title={uploadLimitReached ? resumeUploadLimitMessage("admin") : undefined}
            onClick={() => {
              setUploadModalError(null);
              setUploadModalOpen(true);
            }}
            className={PRIMARY_BTN}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Upload Resume
          </button>
        </div>

        {resumes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#64748B]">
            No resume uploaded yet. Select a job and upload the first resume.
          </p>
        ) : (
          <div>
            <div className="lg:hidden">
              {resumes.map((resume, index) => {
                const row = rowModelForResume(resume, index);
                return <ResumeMobileCard key={resume.id} {...row} />;
              })}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={TABLE_HEADER_RESUME_CLASS}>
                      Resume
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Parse status
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Uploaded date
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Job name
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Uploaded by
                    </th>
                    <th scope="col" className={TABLE_HEADER_CLASS}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumes.map((resume, index) => {
                    const row = rowModelForResume(resume, index);
                    return <ResumeTableRow key={resume.id} {...row} />;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="border-t border-[#E5E7EB] px-5 py-3 text-center text-sm text-[#64748B]">
          Note: You can upload up to {MAX_RESUME_UPLOADS_PER_ROLE} resumes for this candidate in
          total ({adminUploadsUsed} of {MAX_RESUME_UPLOADS_PER_ROLE} used). After that, reupload a
          resume to replace its file.
        </p>
      </section>

      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:px-5">
          <h2 className={SECTION_TITLE_CLASS}>Documents</h2>
          <Link href={`/admin_recruiter/new/attachments/${encodeURIComponent(workerId)}`} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Upload Docs
          </Link>
        </div>
        {otherDocuments.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[#64748B]">
            No docs has been uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#F1F5F9]">
            {otherDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <BrandedFileTypeIcon type="pdf" className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[color:var(--brand-primary)]">
                      {doc.fileName}
                    </p>
                    <p className="text-xs text-[#64748B]">
                      {doc.title}
                      {doc.uploadedAtLabel ? ` · ${doc.uploadedAtLabel}` : ""}
                    </p>
                  </div>
                </div>
                <div className="min-w-[140px] text-right">
                  <p className="truncate text-sm font-medium text-[#334155]">
                    {doc.uploadedByName || "—"}
                  </p>
                  {uploadedByRoleDisplay(doc.uploadedByRoleLabel) ? (
                    <p className="mt-0.5 text-[11px] font-medium text-[#94A3B8]">
                      {uploadedByRoleDisplay(doc.uploadedByRoleLabel)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <input
        ref={reuploadInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => handleReuploadFile(event.target.files?.[0])}
      />

      <UploadResumeModal
        open={uploadModalOpen}
        jobs={applications}
        resumes={resumes}
        uploading={uploading}
        error={uploadModalError}
        onClose={() => {
          if (!uploading) setUploadModalOpen(false);
        }}
        onUpload={(jobApplicationId, file) => {
          setUploadModalOpen(false);
          setPendingUpload({ applicationId: jobApplicationId, file, resumeId: null });
        }}
      />

      <ReplaceResumeConfirmModal
        open={Boolean(pendingUpload)}
        fileName={pendingUpload?.file.name ?? ""}
        busy={uploading}
        hasExistingResume={Boolean(pendingUpload?.resumeId)}
        onCancel={() => {
          if (uploading) return;
          const wasNewUpload = !pendingUpload?.resumeId;
          setPendingUpload(null);
          if (wasNewUpload) setUploadModalOpen(true);
        }}
        onConfirm={() => {
          if (!pendingUpload) return;
          void uploadResume(
            pendingUpload.applicationId,
            pendingUpload.file,
            pendingUpload.resumeId
          );
        }}
      />
    </div>
  );
}
