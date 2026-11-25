"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, FileText, Pencil, Trash2, Upload, X } from "lucide-react";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import {
  CANDIDATE_BTN_MUTED,
  CANDIDATE_BTN_NAVY,
  CANDIDATE_BTN_OUTLINE,
  CandidatePageIntro,
} from "./candidate-portal-ui";
import { MAX_RESUME_UPLOADS_PER_ROLE } from "@/lib/resume/resume-upload-limit";

type ResumeItem = {
  id: string;
  originalFileName: string;
  fileSizeLabel: string;
  uploadedAtLabel: string;
  jobApplicationId: string | null;
};

type AppliedJob = {
  applicationId: string;
  jobTitle: string;
};

const META_KEY = "candidate-resume-meta";

type ResumeMeta = { titles: Record<string, string>; defaultId?: string };

function readMeta(applicantId: string): ResumeMeta {
  try {
    const raw = localStorage.getItem(`${META_KEY}:${applicantId}`);
    const parsed = raw ? (JSON.parse(raw) as Partial<ResumeMeta>) : {};
    return { titles: parsed.titles ?? {}, defaultId: parsed.defaultId };
  } catch {
    return { titles: {} };
  }
}

export function CandidateResumesClient() {
  const { session, sessionReady, authHeaders } = useApplicantPortal();
  const applicantId = session?.applicant.id ?? "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<AppliedJob[]>([]);
  const [usageByResume, setUsageByResume] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobApplicationId, setJobApplicationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [meta, setMeta] = useState<ResumeMeta>({ titles: {} });

  const persistMeta = useCallback(
    (next: ResumeMeta) => {
      setMeta(next);
      if (!applicantId) return;
      localStorage.setItem(`${META_KEY}:${applicantId}`, JSON.stringify(next));
    },
    [applicantId]
  );

  const load = useCallback(async () => {
    if (!sessionReady) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const [resumeRes, appsRes] = await Promise.all([
        fetch("/api/applicant-portal/resumes", { headers, cache: "no-store" }),
        fetch("/api/applicant-portal/applications", { headers, cache: "no-store" }),
      ]);
      const resumePayload = (await resumeRes.json().catch(() => ({}))) as {
        resumes?: ResumeItem[];
        appliedJobs?: AppliedJob[];
        error?: string;
      };
      const appsPayload = (await appsRes.json().catch(() => ({}))) as {
        applications?: Array<{ resume: { id: string } | null }>;
      };
      if (!resumeRes.ok) throw new Error(resumePayload.error || "Could not load resumes.");
      const nextResumes = resumePayload.resumes ?? [];
      setResumes(nextResumes);
      const jobs = resumePayload.appliedJobs ?? [];
      setAppliedJobs(jobs);
      setJobApplicationId((current) => current || jobs[0]?.applicationId || "");
      const counts: Record<string, number> = {};
      for (const application of appsPayload.applications ?? []) {
        const id = application.resume?.id;
        if (!id) continue;
        counts[id] = (counts[id] ?? 0) + 1;
      }
      setUsageByResume(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load resumes.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, sessionReady]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!applicantId) return;
    setMeta(readMeta(applicantId));
  }, [applicantId]);

  const sorted = useMemo(() => resumes, [resumes]);

  async function submitUpload() {
    if (!file) {
      setError("Choose a resume file to upload.");
      return;
    }
    if (resumes.some((resume) => resume.originalFileName.trim().toLowerCase() === file.name.trim().toLowerCase())) {
      setError("A resume with this filename already exists. If this is a different resume, rename the file and upload it again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const body = new FormData();
      body.set("file", file);
      if (jobApplicationId) body.set("jobApplicationId", jobApplicationId);
      const res = await fetch("/api/applicant-portal/resumes", { method: "POST", headers, body });
      const payload = (await res.json().catch(() => ({}))) as { resumes?: ResumeItem[]; error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not upload resume.");
      if (title.trim() && payload.resumes?.[0]) {
        const newest = payload.resumes.find((item) => item.originalFileName === file.name) ?? payload.resumes[0];
        persistMeta({
          ...readMeta(applicantId),
          titles: { ...readMeta(applicantId).titles, [newest.id]: title.trim() },
        });
      }
      setUploadOpen(false);
      setFile(null);
      setTitle("");
      setSuccessOpen(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload resume.");
    } finally {
      setSubmitting(false);
    }
  }

  function displayTitle(resume: ResumeItem): string {
    return meta.titles[resume.id] || resume.originalFileName.replace(/\.[^.]+$/, "");
  }

  async function removeResume(resumeId: string) {
    const headers = await authHeaders();
    if (!headers) return;
    const res = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Could not delete resume.");
      return;
    }
    await load();
  }

  async function replaceResume(resumeId: string, nextFile: File) {
    const headers = await authHeaders();
    if (!headers) return;
    const body = new FormData();
    body.set("file", nextFile);
    const res = await fetch(`/api/applicant-portal/resumes/${encodeURIComponent(resumeId)}`, {
      method: "PATCH",
      headers,
      body,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error || "Could not replace resume.");
      return;
    }
    await load();
  }

  function setDefault(resumeId: string) {
    persistMeta({ ...readMeta(applicantId), defaultId: resumeId });
  }

  const defaultId = meta.defaultId;

  return (
    <div className="w-full min-w-0 px-4 py-6 min-[1000px]:px-8">
      <CandidatePageIntro
        title="Resumes"
        subtitle="Pick a different version for each job. Open applications keep the version you submitted."
        action={
          <button type="button" className={CANDIDATE_BTN_NAVY} onClick={() => setUploadOpen(true)}>
            Upload Resume
          </button>
        }
      />

      {error ? <p role="alert" className="mb-4 text-sm text-[#B91C1C]">{error}</p> : null}
      {loading ? <p className="text-sm text-[#6B7280]">Loading resumes…</p> : null}

      {!loading ? (
        <div className="space-y-4">
          {sorted.length === 0 ? (
            <p className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-8 text-sm text-[#6B7280]">
              You have not uploaded a resume yet.
            </p>
          ) : (
            sorted.map((resume) => {
              const isDefault = defaultId === resume.id;
              const used = usageByResume[resume.id] ?? (resume.jobApplicationId ? 1 : 0);
              return (
                <article
                  key={resume.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 hover:border-[#012352] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#EFF6FF] text-[#012352]">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#012352]">{displayTitle(resume)}</p>
                      <p className="truncate text-xs text-[#6B7280]">{resume.originalFileName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <p className="text-xs text-[#6B7280]">
                      Used on {used} Application{used === 1 ? "" : "s"}
                      {resume.uploadedAtLabel ? ` · Uploaded on ${resume.uploadedAtLabel}` : ""}
                    </p>
                    {isDefault ? (
                      <span className="rounded-md bg-[#EDE9FE] px-2 py-1 text-xs font-medium text-[#6D28D9]">Default</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-[#64748B]"
                          aria-label={`Delete ${resume.originalFileName}`}
                          onClick={() => void removeResume(resume.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="text-[#64748B]"
                          aria-label={`Replace ${resume.originalFileName}`}
                          onClick={() => {
                            setReplaceId(resume.id);
                            replaceInputRef.current?.click();
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className={CANDIDATE_BTN_OUTLINE} onClick={() => setDefault(resume.id)}>
                          Set as default
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })
          )}
          <p className="text-xs text-[#6B7280]">Note: You can upload up to {MAX_RESUME_UPLOADS_PER_ROLE} resumes.</p>
        </div>
      ) : null}

      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(event) => {
          const next = event.target.files?.[0];
          if (next && replaceId) void replaceResume(replaceId, next);
          event.target.value = "";
        }}
      />

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[500px] rounded-[20px] bg-white shadow-[0_20px_50px_rgba(18,27,33,0.2)]">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-xl font-semibold text-black">Upload Resume</h2>
              <button type="button" className={CANDIDATE_BTN_OUTLINE} aria-label="Close" onClick={() => setUploadOpen(false)}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-4 px-5 pb-2">
              {error ? <p role="alert" className="text-sm text-[#B91C1C]">{error}</p> : null}
              <label className="block text-xs text-[#6B7280]">
                Resume Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Resume Title"
                  className="mt-2 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs text-black outline-none"
                />
              </label>
              {appliedJobs.length > 0 ? (
                <label className="block text-xs text-[#6B7280]">
                  Attach to application (optional)
                  <select
                    value={jobApplicationId}
                    onChange={(event) => setJobApplicationId(event.target.value)}
                    className="mt-2 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs text-black"
                  >
                    <option value="">Save to my profile</option>
                    {appliedJobs.map((job) => (
                      <option key={job.applicationId} value={job.applicationId}>
                        {job.jobTitle}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-[#6B7280]">Save a resume to your profile before applying to a job.</p>
              )}
              <div className="rounded-lg border border-dashed border-[#012352] px-5 py-5 text-center">
                <Upload className="mx-auto h-9 w-9 text-[#60A5FA]" aria-hidden />
                <p className="mt-3 text-xs text-[#6B7280]">Drag your file(s) to start uploading</p>
                <div className="my-3 flex items-center gap-3 text-[10px] font-semibold text-black">
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                  OR
                  <span className="h-px flex-1 bg-[#E5E7EB]" />
                </div>
                <button type="button" className={CANDIDATE_BTN_OUTLINE} onClick={() => fileInputRef.current?.click()}>
                  Browse files
                </button>
                <p className="mt-3 text-[10px] text-[#6B7280]">Max 10 MB files are allowed</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <p className="text-xs text-[#6B7280]">Only support .docx or pdf files</p>
              {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-[#012352] p-3.5">
                  <FileText className="h-6 w-6 text-[#012352]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{file.name}</p>
                    <p className="text-[10px] text-[#6B7280]">{(file.size / (1024 * 1024)).toFixed(1)}MB</p>
                  </div>
                  <button type="button" aria-label="Remove file" onClick={() => setFile(null)}>
                    <Trash2 className="h-4 w-4 text-[#64748B]" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 px-5 pt-1 pb-4">
              <button type="button" className={CANDIDATE_BTN_MUTED} onClick={() => setUploadOpen(false)}>
                Cancel
              </button>
              <button type="button" className={CANDIDATE_BTN_NAVY} disabled={submitting} onClick={() => void submitUpload()}>
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {successOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[400px] w-full max-w-[500px] flex-col rounded-[20px] bg-white shadow-[0_20px_50px_rgba(18,27,33,0.2)]">
            <div className="flex justify-end px-5 py-3">
              <button type="button" className={CANDIDATE_BTN_OUTLINE} aria-label="Close" onClick={() => setSuccessOpen(false)}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10 text-center">
              <span className="inline-flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#012352] text-white">
                <Check className="h-8 w-8" aria-hidden />
              </span>
              <h2 className="mt-5 text-2xl font-semibold text-black">Success!</h2>
              <p className="mt-2 text-base text-[#4B5563]">New resume uploaded.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
