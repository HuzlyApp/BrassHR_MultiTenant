"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import BrandedFileTypeIcon from "@/app/admin_recruiter/components/BrandedFileTypeIcon";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WorkerFilePicker } from "./WorkerFilePicker";
import {
  WORKER_BTN_OUTLINE,
  WORKER_BTN_OUTLINE_BRAND,
  WORKER_BTN_PRIMARY,
} from "./worker-portal-buttons";
import {
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_DOCUMENTS_PAGE_SECTION_TITLE_CLASS,
  WORKER_DOCUMENTS_PAGE_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";
import {
  MAX_RESUME_UPLOADS_PER_ROLE,
  resumeUploadLimitMessage,
} from "@/lib/resume/resume-upload-limit";

type WorkerAppliedJob = {
  applicationId: string;
  jobTitle: string;
  location: string | null;
  statusLabel: string;
};

const UPLOAD_MODAL_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

type WorkerResumeItem = {
  id: string;
  originalFileName: string;
  fileType: string | null;
  fileSizeLabel: string;
  parsingStatus: "pending" | "processing" | "completed" | "failed";
  parsingStatusLabel: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  jobApplicationId: string | null;
  jobTitle: string | null;
  uploadedByName: string;
  uploadedByPhotoUrl?: string | null;
  uploadedByRoleLabel?: "Admin" | "Worker" | "";
};

function workerUploadCountForJob(resumes: WorkerResumeItem[], jobApplicationId: string): number {
  return resumes.filter(
    (resume) =>
      resume.jobApplicationId === jobApplicationId && resume.uploadedByRoleLabel !== "Admin"
  ).length;
}

function ResumeUploaderCell({ resume }: { resume: WorkerResumeItem }) {
  return (
    <div className="min-w-0 text-left min-[900px]:text-right" title={resume.uploadedByName}>
      <p className="truncate text-sm font-medium leading-5 text-[#334155]">
        {resume.uploadedByName}
      </p>
      {resume.uploadedByRoleLabel ? (
        <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#94A3B8]">
          {resume.uploadedByRoleLabel}
        </p>
      ) : null}
    </div>
  );
}

function ResumeParseBadge({
  status,
  label,
}: {
  status: WorkerResumeItem["parsingStatus"];
  label: string;
}) {
  const isParsed = status === "completed";
  const tone = isParsed
    ? "border-transparent bg-[color:var(--brand-secondary)] text-white"
    : status === "failed"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[#E5E7EB] bg-[#F8FAFC] text-[#64748B]";

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${tone}`}>
      {isParsed ? <Check className="h-3 w-3" aria-hidden /> : null}
      {label}
    </span>
  );
}

function ResumeRow({
  resume,
  index,
  busy,
  onView,
  onReupload,
  onDelete,
}: {
  resume: WorkerResumeItem;
  index: number;
  busy: boolean;
  onView: () => void;
  onReupload: (file: File) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-3 border-b border-[#E5E7EB] px-4 py-4 last:border-b-0 min-[900px]:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(0,7.5rem)_auto_auto] min-[900px]:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] text-xs font-semibold text-[color:var(--brand-primary)]">
          {index}
        </span>
        <BrandedFileTypeIcon type="pdf" className="mt-0.5 h-8 w-8 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--brand-primary)]">
            {resume.originalFileName}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">{resume.fileSizeLabel}</p>
          <p className="mt-0.5 text-xs text-[#94A3B8] min-[900px]:hidden">
            {resume.jobTitle || "General application"}
          </p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">Uploaded {resume.uploadedAtLabel}</p>
          <div className="mt-2 min-[900px]:hidden">
            <p className="text-xs font-medium text-[#64748B]">Uploaded by</p>
            <div className="mt-1">
              <ResumeUploaderCell resume={resume} />
            </div>
          </div>
        </div>
      </div>

      <div className="min-w-0 pl-10 min-[900px]:pl-0">
        <p className="truncate text-sm font-semibold text-[#0F172A]">
          {resume.jobTitle || "—"}
        </p>
        <p className="mt-0.5 text-xs text-[#64748B]">Job applied</p>
      </div>

      <div className="hidden min-w-0 min-[900px]:block">
        <p className="mb-1 text-xs font-medium text-[#64748B] min-[900px]:text-right">Uploaded by</p>
        <ResumeUploaderCell resume={resume} />
      </div>

      <div className="flex items-center pl-10 min-[900px]:justify-center min-[900px]:pl-0">
        <ResumeParseBadge status={resume.parsingStatus} label={resume.parsingStatusLabel} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-10 min-[900px]:justify-end min-[900px]:pl-0">
        <button type="button" disabled={busy} onClick={onView} className={WORKER_BTN_OUTLINE_BRAND}>
          View
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={WORKER_BTN_OUTLINE_BRAND}
        >
          Reupload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onReupload(file);
            event.target.value = "";
          }}
        />
        <button type="button" disabled={busy} onClick={onDelete} className={WORKER_BTN_OUTLINE_BRAND}>
          Delete
        </button>
      </div>
    </div>
  );
}

function UploadResumeModal({
  open,
  appliedJobs,
  resumes,
  uploading,
  error,
  onClose,
  onUpload,
}: {
  open: boolean;
  appliedJobs: WorkerAppliedJob[];
  resumes: WorkerResumeItem[];
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

  const selectedJobUploadCount = selectedJobId
    ? workerUploadCountForJob(resumes, selectedJobId)
    : 0;
  const selectedJobAtLimit = selectedJobUploadCount >= MAX_RESUME_UPLOADS_PER_ROLE;

  function handleSubmit() {
    const nextErrors: { job?: string; file?: string } = {};
    if (!selectedJobId) nextErrors.job = "Select a job.";
    if (selectedJobId && workerUploadCountForJob(resumes, selectedJobId) >= MAX_RESUME_UPLOADS_PER_ROLE) {
      nextErrors.job = resumeUploadLimitMessage("worker");
    }
    if (!selectedFile) nextErrors.file = "Choose a resume file.";
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
        aria-labelledby="upload-resume-title"
        className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div className="min-w-0 pr-2">
            <h2 id="upload-resume-title" className="text-lg font-semibold text-[#0F172A]">
              Upload Resume
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Select the job this resume is for, then choose your file. You can upload up to{" "}
              {MAX_RESUME_UPLOADS_PER_ROLE} resumes per job.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-[#F1F5F9]"
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

          {appliedJobs.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              You have not applied to any jobs yet. Apply to a job first, then upload a resume for
              that application.
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="resume-job-select" className="mb-2 block text-sm font-medium text-[#374151]">
                  Job
                </label>
                <select
                  id="resume-job-select"
                  value={selectedJobId}
                  onChange={(event) => {
                    setSelectedJobId(event.target.value);
                    if (fieldErrors.job) setFieldErrors((current) => ({ ...current, job: undefined }));
                  }}
                  disabled={uploading}
                  style={UPLOAD_MODAL_SELECT_CHEVRON}
                  className={`h-11 w-full cursor-pointer appearance-none rounded-lg border bg-white bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pl-3 pr-10 text-sm text-[#334155] outline-none focus:border-[color:var(--brand-primary)] focus:ring-0 ${
                    fieldErrors.job ? "border-red-300" : "border-[#D1D5DB]"
                  } ${!selectedJobId ? "text-[#94A3B8]" : ""}`}
                >
                  <option value="">Select a job</option>
                  {appliedJobs.map((job) => {
                    const count = workerUploadCountForJob(resumes, job.applicationId);
                    return (
                      <option key={job.applicationId} value={job.applicationId}>
                        {job.jobTitle} ({count}/{MAX_RESUME_UPLOADS_PER_ROLE})
                      </option>
                    );
                  })}
                </select>
                {fieldErrors.job ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.job}</p>
                ) : selectedJobAtLimit ? (
                  <p className="mt-1 text-xs text-red-600">{resumeUploadLimitMessage("worker")}</p>
                ) : selectedJobId ? (
                  <p className="mt-1 text-xs text-[#64748B]">
                    {selectedJobUploadCount} of {MAX_RESUME_UPLOADS_PER_ROLE} worker uploads used
                    for this job.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[#374151]">Resume file</label>
                <WorkerFilePicker
                  inputRef={fileInputRef}
                  file={selectedFile}
                  onChange={(file) => {
                    setSelectedFile(file);
                    if (fieldErrors.file) setFieldErrors((current) => ({ ...current, file: undefined }));
                  }}
                  disabled={uploading}
                  error={fieldErrors.file}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#E5E7EB] px-6 py-5">
          <button type="button" disabled={uploading} onClick={onClose} className={WORKER_BTN_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={uploading || appliedJobs.length === 0 || selectedJobAtLimit}
            onClick={handleSubmit}
            className={WORKER_BTN_PRIMARY}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload Resume"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkerResumeSubmittedSection() {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const [resumes, setResumes] = useState<WorkerResumeItem[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<WorkerAppliedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyResumeId, setBusyResumeId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalError, setUploadModalError] = useState<string | null>(null);

  const loadResumes = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch("/api/applicant-portal/resumes", { headers, cache: "no-store" });
    const payload = (await res.json().catch(() => ({}))) as {
      resumes?: WorkerResumeItem[];
      appliedJobs?: WorkerAppliedJob[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || "Could not load resumes.");
    setResumes(payload.resumes ?? []);
    setAppliedJobs(payload.appliedJobs ?? []);
  }, [authHeaders]);

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;
    setLoading(true);
    void loadResumes()
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Could not load resumes.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadResumes, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    const hasProcessing = resumes.some(
      (resume) => resume.parsingStatus === "processing" || resume.parsingStatus === "pending"
    );
    if (!hasProcessing) return;

    const timer = window.setInterval(() => {
      void loadResumes().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [loadResumes, resumes, sessionReady]);

  async function openResume(resumeId: string) {
    setError(null);
    setBusyResumeId(resumeId);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`, {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      const url = payload.url?.trim() ?? "";
      if (!res.ok || !url) throw new Error(payload.error || "Could not open resume.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  async function uploadResume(jobApplicationId: string, file: File, resumeId?: string) {
    if (resumeId) setBusyResumeId(resumeId);
    else setUploading(true);

    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const form = new FormData();
      form.append("file", file);
      if (!resumeId) form.append("jobApplicationId", jobApplicationId);
      const res = await fetch(
        resumeId
          ? `/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`
          : "/api/applicant-portal/resumes",
        {
          method: resumeId ? "PATCH" : "POST",
          headers,
          body: form,
        }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        resumes?: WorkerResumeItem[];
        appliedJobs?: WorkerAppliedJob[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not upload resume.");
      setResumes(payload.resumes ?? []);
      setAppliedJobs(payload.appliedJobs ?? []);
      setUploadModalOpen(false);
      setUploadModalError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload resume.";
      if (resumeId) setError(message);
      else setUploadModalError(message);
    } finally {
      setUploading(false);
      setBusyResumeId(null);
    }
  }

  async function deleteResume(resumeId: string) {
    const resume = resumes.find((item) => item.id === resumeId);
    const label = resume?.originalFileName || "this resume";
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    setError(null);
    setBusyResumeId(resumeId);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`, {
        method: "DELETE",
        headers,
      });
      const payload = (await res.json().catch(() => ({}))) as {
        resumes?: WorkerResumeItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not delete resume.");
      setResumes(payload.resumes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete resume.");
    } finally {
      setBusyResumeId(null);
    }
  }

  const sectionBusy = uploading || busyResumeId != null;

  return (
    <>
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <div>
            <h2
              className={WORKER_DOCUMENTS_PAGE_SECTION_TITLE_CLASS}
              style={WORKER_DOCUMENTS_PAGE_SECTION_TITLE_STYLE}
            >
              Resume Submitted
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Upload up to {MAX_RESUME_UPLOADS_PER_ROLE} resumes per job. Previous uploads stay in
              your history.
            </p>
          </div>
          <button
            type="button"
            disabled={sectionBusy}
            onClick={() => {
              setUploadModalError(null);
              setUploadModalOpen(true);
            }}
            className={`${WORKER_BTN_PRIMARY} shrink-0`}
          >
            <Upload className="h-4 w-4" />
            Upload Resume
          </button>
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-[#64748B]">Loading resumes…</p>
        ) : resumes.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#64748B]">
            No resume uploaded yet. Select a job and upload your first resume.
          </p>
        ) : (
          <div>
            {resumes.map((resume, index) => (
              <ResumeRow
                key={resume.id}
                resume={resume}
                index={index + 1}
                busy={sectionBusy && (uploading || busyResumeId === resume.id)}
                onView={() => void openResume(resume.id)}
                onReupload={(file) => void uploadResume(resume.jobApplicationId ?? "", file, resume.id)}
                onDelete={() => void deleteResume(resume.id)}
              />
            ))}
          </div>
        )}
      </div>

      <UploadResumeModal
        open={uploadModalOpen}
        appliedJobs={appliedJobs}
        resumes={resumes}
        uploading={uploading}
        error={uploadModalError}
        onClose={() => {
          if (!uploading) setUploadModalOpen(false);
        }}
        onUpload={(jobApplicationId, file) => void uploadResume(jobApplicationId, file)}
      />
    </>
  );
}
