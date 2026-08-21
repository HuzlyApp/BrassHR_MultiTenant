"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search, X } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  JobsViewToggle,
  type JobsListingView,
} from "@/app/admin_recruiter/jobs/JobsViewToggle";
import { applicantPortalApiPath, resolveApplicantPortalTenantSlug } from "@/lib/applicant-portal/client-tenant";
import type { WorkerJobApplicationListItem } from "@/lib/applicant-portal/list-worker-job-applications";
import { jobDescriptionPlainText } from "@/lib/jobs/job-description-html";
import {
  normalizeJobToken,
  publicJobDisplayTitle,
} from "@/lib/jobs/public-application-routing";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { WORKER_BTN_OUTLINE, WORKER_BTN_PRIMARY, WORKER_BTN_PRIMARY_SM } from "./worker-portal-buttons";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
} from "./worker-schedule-typography";

type WorkerFacingStatus = "Open" | "Under Review" | "Hired" | "Rejected";

function workerFacingJobStatus(application: WorkerJobApplicationListItem | null): {
  label: WorkerFacingStatus;
  badgeClass: string;
  useBrand?: boolean;
} {
  if (!application) {
    return {
      label: "Open",
      badgeClass:
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
      useBrand: true,
    };
  }

  const pipeline = normalizeApplicationStatus(application.status);
  const name = (application.statusName || "").trim().toLowerCase();

  if (
    pipeline === "hired" ||
    name === "hired" ||
    name === "approved" ||
    name.includes("hired")
  ) {
    return {
      label: "Hired",
      badgeClass:
        "inline-flex items-center rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#15803D]",
    };
  }

  if (
    pipeline === "rejected" ||
    name === "rejected" ||
    name === "declined" ||
    name.includes("reject")
  ) {
    return {
      label: "Rejected",
      badgeClass:
        "inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-1 text-xs font-medium text-[#B91C1C]",
    };
  }

  // Applied / in-progress pipeline statuses (new, reviewing, interviewing, etc.)
  return {
    label: "Under Review",
    badgeClass:
      "inline-flex items-center rounded-full bg-[#DBEAFE] px-2.5 py-1 text-xs font-medium text-[#1D4ED8]",
  };
}

type PublicJob = {
  id?: string;
  public_job_token: string;
  public_title: string;
  source_job_title?: string | null;
  source_type?: string | null;
  public_description: string | null;
  location: string | null;
  schedule: string | null;
  employment_type: string | null;
  published_at: string | null;
  application_deadline?: string | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  professions: { name?: string } | { name?: string }[] | null;
  specialties: { name?: string } | { name?: string }[] | null;
};

type WorkerJobRow = {
  job: PublicJob;
  token: string;
  title: string;
  location: string;
  employmentType: string;
  profession: string;
  specialty: string;
  description: string;
  publishedAt: string | null;
  application: WorkerJobApplicationListItem | null;
  applied: boolean;
};

const FILTER_INPUT_CLASS =
  "h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)]";

const SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

function relationName(value: PublicJob["professions"]): string {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name?.trim() || "";
}

function formatAppliedDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function workTypeBadgeClass(workType: string): string {
  const value = workType.trim().toUpperCase();
  if (value === "1099") return "bg-[#F3E8FF] text-[#7E22CE]";
  if (value === "W2") return "bg-[#DBEAFE] text-[#1D4ED8]";
  if (value === "CONTRACT") return "bg-[#FFEDD5] text-[#C2410C]";
  return "bg-[#F1F5F9] text-[#475569]";
}

function StatusBadge({ status }: { status: ReturnType<typeof workerFacingJobStatus> }) {
  return (
    <span
      className={status.badgeClass}
      style={
        status.useBrand
          ? {
              backgroundColor: "color-mix(in srgb, var(--brand-primary) 16%, white)",
              color: "var(--brand-primary)",
            }
          : undefined
      }
    >
      {status.label}
    </span>
  );
}

function JobApplyAction({
  row,
  fullWidth = false,
  onApply,
}: {
  row: WorkerJobRow;
  fullWidth?: boolean;
  onApply: (row: WorkerJobRow) => void;
}) {
  if (row.applied) {
    return (
      <span
        className={`inline-flex h-9 items-center justify-center rounded-md border border-[#E5E7EB] px-3 text-xs font-semibold text-[#64748B] ${
          fullWidth ? "w-full" : ""
        }`}
      >
        Applied
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${WORKER_BTN_PRIMARY_SM} ${fullWidth ? "w-full sm:w-auto" : ""}`}
      onClick={() => onApply(row)}
    >
      Apply
    </button>
  );
}

function JobMobileListCard({
  row,
  onApply,
}: {
  row: WorkerJobRow;
  onApply: (row: WorkerJobRow) => void;
}) {
  const status = workerFacingJobStatus(row.application);
  return (
    <article className="border-b border-[#F1F5F9] px-3 py-4 last:border-b-0 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-5 text-[#0F172A]">{row.title}</p>
          {row.profession ? (
            <p className="mt-0.5 text-xs text-[#64748B]">
              {row.profession}
              {row.specialty ? ` · ${row.specialty}` : ""}
            </p>
          ) : null}
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="mt-3 space-y-2 text-sm text-[#334155]">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
          <span className="min-w-0 break-words">{row.location}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {row.employmentType ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${workTypeBadgeClass(row.employmentType)}`}
            >
              {row.employmentType}
            </span>
          ) : null}
          <span className="text-xs text-[#64748B]">
            Applied: {row.applied ? formatAppliedDate(row.application?.appliedAt) : "—"}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <JobApplyAction row={row} fullWidth onApply={onApply} />
      </div>
    </article>
  );
}

function JobGridCard({
  row,
  tenantSlug,
  onApply,
}: {
  row: WorkerJobRow;
  tenantSlug: string;
  onApply: (row: WorkerJobRow) => void;
}) {
  const status = workerFacingJobStatus(row.application);
  const detailsHref =
    row.token && tenantSlug
      ? `/jobs/${encodeURIComponent(row.token)}?tenant=${encodeURIComponent(tenantSlug)}`
      : null;

  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-lg font-semibold leading-6 text-[#0F172A]">
          {row.title}
        </h3>
        {row.employmentType ? (
          <span className="shrink-0 rounded-full bg-[color:color-mix(in_srgb,var(--brand-primary)_14%,white)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-primary)]">
            {row.employmentType}
          </span>
        ) : null}
      </div>

      {row.profession ? (
        <p className="mt-2 text-sm font-medium text-[#334155]">{row.profession}</p>
      ) : null}
      {row.specialty ? <p className="mt-1 text-sm text-[#64748B]">{row.specialty}</p> : null}
      <p className="mt-2 text-sm font-medium text-[#64748B]">{row.location}</p>

      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-[#64748B]">
        {row.description || "No description provided."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} />
        {row.applied ? (
          <span className="text-xs text-[#64748B]">
            Applied {formatAppliedDate(row.application?.appliedAt)}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {row.applied ? (
          <span className="inline-flex h-10 items-center justify-center rounded-lg border border-[#E5E7EB] px-4 text-sm font-semibold text-[#64748B]">
            Applied
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onApply(row)}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
          >
            Apply
          </button>
        )}
        {detailsHref ? (
          <Link
            href={detailsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
          >
            View details
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ApplyConfirmModal({
  open,
  jobTitle,
  submitting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  jobTitle: string;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-apply-job-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#E5E7EB] bg-white shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h3 id="worker-apply-job-title" className="text-base font-semibold text-[#0F172A]">
              Apply for job
            </h3>
            <p className="mt-1 break-words text-sm text-[#64748B]" title={jobTitle}>
              {jobTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-5 sm:px-5">
          <p className="text-sm text-[#64748B]">
            Your latest uploaded resume from Documents will be attached automatically. Continue to
            apply with your existing worker profile?
          </p>
          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E5E7EB] px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-5">
          <button type="button" disabled={submitting} onClick={onClose} className={WORKER_BTN_OUTLINE}>
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            className={WORKER_BTN_PRIMARY}
            onClick={onConfirm}
          >
            {submitting ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkerJobsTab() {
  const { sessionReady, authHeaders } = useApplicantPortal();
  const branding = useTenantBranding();
  const tenantSlug =
    branding.slug?.trim().toLowerCase() || resolveApplicantPortalTenantSlug() || "";

  const [view, setView] = useState<JobsListingView>("list");
  const [query, setQuery] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [applications, setApplications] = useState<WorkerJobApplicationListItem[]>([]);

  const [applyJob, setApplyJob] = useState<WorkerJobRow | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionReady) return;
    if (!tenantSlug) {
      setError("Tenant could not be resolved. Refresh the page and try again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const params = new URLSearchParams({
        tenant: tenantSlug,
        page: "1",
        pageSize: "50",
      });
      if (query.trim()) params.set("q", query.trim());
      if (employmentType) params.set("employmentType", employmentType);

      const [jobsRes, appsRes] = await Promise.all([
        fetch(`/api/public/jobs?${params}`, { cache: "no-store" }),
        fetch(applicantPortalApiPath("/api/applicant-portal/applications"), {
          headers,
          cache: "no-store",
        }),
      ]);

      const jobsPayload = (await jobsRes.json().catch(() => ({}))) as {
        jobs?: PublicJob[];
        error?: string;
      };
      const appsPayload = (await appsRes.json().catch(() => ({}))) as {
        applications?: WorkerJobApplicationListItem[];
        error?: string;
      };

      if (!jobsRes.ok) throw new Error(jobsPayload.error || "Could not load active jobs.");
      if (!appsRes.ok) throw new Error(appsPayload.error || "Could not load applications.");

      setJobs(jobsPayload.jobs ?? []);
      setApplications(appsPayload.applications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load jobs.");
      setJobs([]);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, employmentType, query, sessionReady, tenantSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const applicationByJobId = useMemo(() => {
    const map = new Map<string, WorkerJobApplicationListItem>();
    for (const app of applications) {
      const key = app.jobRequisitionId.trim();
      if (key && !map.has(key)) map.set(key, app);
    }
    return map;
  }, [applications]);

  const rows = useMemo<WorkerJobRow[]>(() => {
    return jobs
      .map((job) => {
        const token = normalizeJobToken(job.public_job_token) || "";
        const jobId = String(job.id ?? "").trim();
        const application = jobId ? applicationByJobId.get(jobId) ?? null : null;
        return {
          job,
          token,
          title: publicJobDisplayTitle(job),
          location: job.location?.trim() || "—",
          employmentType: job.employment_type?.trim() || "",
          profession: relationName(job.professions),
          specialty: relationName(job.specialties),
          description: jobDescriptionPlainText(job.public_description || ""),
          publishedAt: job.published_at,
          application,
          applied: Boolean(application),
        };
      })
      .filter((row) => Boolean(row.token));
  }, [applicationByJobId, jobs]);

  function openApplyModal(row: WorkerJobRow) {
    if (row.applied) return;
    setApplyJob(row);
    setApplyError(null);
  }

  async function submitApplication() {
    if (!applyJob) return;
    setApplying(true);
    setApplyError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");
      const res = await fetch(applicantPortalApiPath("/api/applicant-portal/jobs/apply"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jobToken: applyJob.token }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not apply for this job.");
      setApplyJob(null);
      await load();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not apply for this job.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} max-w-full overflow-x-hidden pb-8`}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
            Jobs
          </h1>
          <p
            className={`${WORKER_SCHEDULE_SUBTITLE_CLASS} text-[14px] sm:text-[16px]`}
            style={WORKER_SCHEDULE_SUBTITLE_STYLE}
          >
            Browse active openings and apply with a resume from your Documents.
          </p>
        </div>
        <div className="shrink-0 self-start sm:self-auto">
          <JobsViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} mb-4 p-3 sm:mb-5 sm:p-4`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[1fr_180px]">
          <label className="relative block min-w-0 sm:col-span-2 md:col-span-1">
            <span className="sr-only">Search jobs</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or keyword"
              className={`${FILTER_INPUT_CLASS} pl-9`}
            />
          </label>
          <label className="block min-w-0">
            <span className="sr-only">Employment type</span>
            <select
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
              style={SELECT_CHEVRON}
              className={`${FILTER_INPUT_CLASS} cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-9`}
            >
              <option value="">All employment types</option>
              <option value="W2">W2</option>
              <option value="1099">1099</option>
              <option value="Contract">Contract</option>
            </select>
          </label>
        </div>
      </section>

      <section className={`${WORKER_SCHEDULE_CARD_CLASS} min-w-0`}>
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-3 py-3 sm:px-4 sm:py-4">
          <div className="min-w-0">
            <h2 className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
              Active jobs
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              {rows.length} open {rows.length === 1 ? "position" : "positions"}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="px-3 py-8 text-sm text-[#64748B] sm:px-4 sm:py-10">Loading active jobs…</p>
        ) : error ? (
          <p className="px-3 py-8 text-sm text-[#B91C1C] sm:px-4 sm:py-10">{error}</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-8 text-sm text-[#64748B] sm:px-4 sm:py-10">
            There are no active jobs right now.
          </p>
        ) : view === "list" ? (
          <>
            {/* Mobile / tablet: stacked cards */}
            <div className="md:hidden">
              {rows.map((row) => (
                <JobMobileListCard
                  key={row.token}
                  row={row}
                  onApply={(next) => void openApplyModal(next)}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-sm font-medium text-[#64748B]">
                    <th className="px-4 py-3 font-medium">Job title</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Work type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Applied date</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const status = workerFacingJobStatus(row.application);
                    return (
                      <tr key={row.token} className="border-b border-[#F1F5F9] last:border-b-0">
                        <td className="px-4 py-4 align-top">
                          <p className="text-sm font-semibold text-[#0F172A]">{row.title}</p>
                          {row.profession ? (
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              {row.profession}
                              {row.specialty ? ` · ${row.specialty}` : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="max-w-[220px] px-4 py-4 align-top text-sm text-[#334155]">
                          <span className="line-clamp-2">{row.location}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          {row.employmentType ? (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${workTypeBadgeClass(row.employmentType)}`}
                            >
                              {row.employmentType}
                            </span>
                          ) : (
                            <span className="text-sm text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <StatusBadge status={status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 align-top text-sm text-[#334155]">
                          {row.applied ? formatAppliedDate(row.application?.appliedAt) : "—"}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <JobApplyAction
                            row={row}
                            onApply={(next) => void openApplyModal(next)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <JobGridCard
                key={row.token}
                row={row}
                tenantSlug={tenantSlug}
                onApply={(next) => void openApplyModal(next)}
              />
            ))}
          </div>
        )}
      </section>

      <ApplyConfirmModal
        open={Boolean(applyJob)}
        jobTitle={applyJob?.title || ""}
        submitting={applying}
        error={applyError}
        onClose={() => {
          if (applying) return;
          setApplyJob(null);
          setApplyError(null);
        }}
        onConfirm={() => void submitApplication()}
      />
    </div>
  );
}
