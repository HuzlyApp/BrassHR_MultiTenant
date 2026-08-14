"use client";

import Link from "next/link";
import { Copy, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import {
  analyzedApplicantCount,
  applicantCount,
  jobCandidatesHref,
  jobDisplayId,
  jobListDisplayTitle,
  jobLocation,
  publicJobPathFor,
  readyToSubmitCount,
  strongMatchCount,
  type JobListRow,
} from "./render-job-list-cell";

type JobsGridViewProps = {
  jobs: JobListRow[];
  loading: boolean;
  emptyMessage: string;
  tenantSlug: string | null;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
};

function gridStatusLabel(job: JobListRow): string {
  const status = normalizeJobRequisitionStatus(String(job.status ?? ""));
  if (status === "published" && isJobRequisitionOpen(job)) return "OPEN";
  if (status === "draft") return "DRAFT";
  if (status === "closed") return "CLOSED";
  if (status === "archived") return "ARCHIVED";
  return status.toUpperCase();
}

function iconButtonClass(disabled?: boolean) {
  return `inline-flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition hover:bg-[#F8FAFC] hover:text-[#475569] ${
    disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-[#94A3B8]" : ""
  }`;
}

function JobGridCard({
  job,
  tenantSlug,
  onDelete,
  onDuplicate,
}: {
  job: JobListRow;
  tenantSlug: string | null;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
}) {
  const title = jobListDisplayTitle(job);
  const location = jobLocation(job);
  const publicHref = publicJobPathFor(job, tenantSlug);
  const candidateCount = applicantCount(job);
  const candidatesHref = jobCandidatesHref(job.id);
  const metrics = [
    {
      label: "CAND",
      value: candidateCount,
      href: candidatesHref,
      ariaLabel: `View ${candidateCount} candidate${candidateCount === 1 ? "" : "s"} for ${title}`,
    },
    { label: "ANALYSIS", value: analyzedApplicantCount(job) },
    { label: "STRONG", value: strongMatchCount(job) },
    { label: "READY", value: readyToSubmitCount(job) },
  ];

  return (
    <article className="flex flex-col rounded-[12px] border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin_recruiter/jobs/${job.id}`}
            className="block truncate text-sm font-semibold leading-5 text-[#0F172A] hover:underline"
          >
            {title}
          </Link>
          <p className="mt-1 truncate text-xs leading-4 text-[#64748B]">{location}</p>
        </div>
        <span className="inline-flex h-7 shrink-0 items-center justify-center rounded-full border-2 border-[#CBD5E1] px-3 text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-[#0F172A]">
          {gridStatusLabel(job)}
        </span>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        {metrics.map((metric) => {
          const metricClassName =
            "flex min-h-[42px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg bg-[#F8F8F8] px-1 py-1.5";
          const body = (
            <>
              <p className="text-base font-semibold leading-5 text-[#0F172A]">{metric.value}</p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#94A3B8]">
                {metric.label}
              </p>
            </>
          );
          if ("href" in metric && metric.href) {
            return (
              <Link
                key={metric.label}
                href={metric.href}
                aria-label={metric.ariaLabel}
                title={metric.ariaLabel}
                className={`${metricClassName} cursor-pointer transition hover:bg-[#F1F5F9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]`}
              >
                {body}
              </Link>
            );
          }
          return (
            <div key={metric.label} className={metricClassName}>
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3">
        <p className="truncate text-xs text-[#64748B]">
          Job ID: <span className="font-semibold text-[#334155]">{jobDisplayId(job)}</span>
        </p>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className={iconButtonClass()}
            aria-label={`Delete ${title}`}
            title="Delete"
            onClick={() => onDelete(job.id)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
          <Link
            href={`/admin_recruiter/jobs/${job.id}/edit`}
            className={iconButtonClass()}
            aria-label={`Edit ${title}`}
            title="Edit"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <button
            type="button"
            className={iconButtonClass()}
            aria-label={`Duplicate ${title}`}
            title="Duplicate"
            onClick={() => onDuplicate(job.id)}
          >
            <Copy className="h-4 w-4" aria-hidden />
          </button>
          {publicHref ? (
            <Link
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className={iconButtonClass()}
              aria-label={`Open public page for ${title}`}
              title="Public view"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={iconButtonClass(true)} title="Publish this job to view the public page">
              <ExternalLink className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function JobsGridView({
  jobs,
  loading,
  emptyMessage,
  tenantSlug,
  onDelete,
  onDuplicate,
}: JobsGridViewProps) {
  if (loading) {
    return <p className="px-4 py-12 text-center text-sm text-[#64748B]">Loading jobs…</p>;
  }

  if (jobs.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-[#64748B]">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {jobs.map((job) => (
        <JobGridCard
          key={job.id}
          job={job}
          tenantSlug={tenantSlug}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}
