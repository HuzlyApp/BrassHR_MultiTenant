"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const JOBS_DASHBOARD_HREF = "/admin_recruiter/jobs";
export const JOBS_LISTING_HREF = "/admin_recruiter/jobs?view=all";
export const JOB_CANDIDATES_HREF = "/admin_recruiter/applications";

export type JobsBreadcrumbPage =
  | "dashboard"
  | "jobs"
  | "job-candidates"
  | "job-details"
  | "applicant"
  | "ai-analysis";

type Crumb = {
  label: string;
  href?: string;
};

type JobsBreadcrumbProps = {
  page: JobsBreadcrumbPage;
  /** Overrides the Job Candidates link when drilling into a specific job. */
  jobCandidatesHref?: string;
  className?: string;
};

function buildCrumbs(page: JobsBreadcrumbPage, jobCandidatesHref: string): Crumb[] {
  const jobCandidates: Crumb = { label: "Job Candidates", href: jobCandidatesHref };

  switch (page) {
    case "dashboard":
      return [{ label: "Jobs Dashboard" }];
    case "jobs":
      return [
        { label: "Jobs Dashboard", href: JOBS_DASHBOARD_HREF },
        { label: "Jobs" },
      ];
    case "job-candidates":
      return [
        { label: "Jobs Dashboard", href: JOBS_DASHBOARD_HREF },
        { label: "Jobs", href: JOBS_LISTING_HREF },
        { label: "Job Candidates" },
      ];
    case "job-details":
      return [
        { label: "Jobs Dashboard", href: JOBS_DASHBOARD_HREF },
        { label: "Jobs", href: JOBS_LISTING_HREF },
        { label: "Job Details" },
      ];
    case "applicant":
      return [
        { label: "Jobs Dashboard", href: JOBS_DASHBOARD_HREF },
        { label: "Jobs", href: JOBS_LISTING_HREF },
        jobCandidates,
        { label: "Applicant" },
      ];
    case "ai-analysis":
      return [
        { label: "Jobs Dashboard", href: JOBS_DASHBOARD_HREF },
        { label: "Jobs", href: JOBS_LISTING_HREF },
        jobCandidates,
        { label: "AI Analysis" },
      ];
    default:
      return [];
  }
}

export function JobsBreadcrumb({
  page,
  jobCandidatesHref = JOB_CANDIDATES_HREF,
  className = "mb-4",
}: JobsBreadcrumbProps) {
  const crumbs = buildCrumbs(page, jobCandidatesHref);
  if (crumbs.length <= 1) return null;

  return (
    <nav className={`flex flex-wrap items-center gap-2 text-sm text-[#64748B] ${className}`} aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="cursor-pointer transition hover:text-[color:var(--brand-primary)] hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-medium text-[#0F172A]">{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** Candidates listing trail (non-jobs entry). */
export function CandidatesBreadcrumb({
  currentLabel,
  backHref = "/admin_recruiter/candidates",
  backLabel = "Candidates",
  className = "mb-4",
}: {
  currentLabel: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  return (
    <nav className={`flex flex-wrap items-center gap-2 text-sm text-[#64748B] ${className}`} aria-label="Breadcrumb">
      <Link
        href={backHref}
        className="cursor-pointer transition hover:text-[color:var(--brand-primary)] hover:underline"
      >
        {backLabel}
      </Link>
      <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="font-medium text-[#0F172A]">{currentLabel}</span>
    </nav>
  );
}

export function jobCandidatesHrefForJob(jobId?: string | null): string {
  const id = jobId?.trim();
  return id
    ? `${JOB_CANDIDATES_HREF}?jobId=${encodeURIComponent(id)}`
    : JOB_CANDIDATES_HREF;
}
