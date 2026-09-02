"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import { JobsGridView } from "./JobsGridView";
import {
  applicantCount,
  hiredApplicantCount,
  jobListDisplayTitle,
  strongMatchCount,
  type JobListRow,
} from "./render-job-list-cell";

const JOBS_ICONS = "/icons/jobs-icons";
const WORKSPACE_PAGE_SIZE = 16;

type KpiIcon = {
  src: string;
  bg: string;
  leafWidth: number;
  leafHeight: number;
};

type KpiCard = {
  label: string;
  value: number;
  icon: KpiIcon;
  href: string;
};

const JOBS_LISTING_HREF = "/admin_recruiter/jobs?view=all";
const JOBS_NEW_HREF = "/admin_recruiter/jobs/new";
const JOBS_OPEN_HREF = `${JOBS_LISTING_HREF}&tab=open`;
const APPLICATIONS_HREF = "/admin_recruiter/applications";
const CANDIDATES_HREF = "/admin_recruiter/candidates";

const JOBS_VIEW_ALL_BUTTON_CLASS =
  "inline-flex h-8 w-full shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-secondary)] bg-white px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-[color:var(--brand-secondary)] no-underline transition hover:bg-[color:color-mix(in_srgb,var(--brand-secondary)_6%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-secondary)_30%,transparent)] sm:w-auto";

const JOBS_CREATE_BUTTON_CLASS =
  "inline-flex h-8 w-full shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-white no-underline transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)] sm:w-auto";

const STATUS_KPI_ICONS: Record<string, KpiIcon> = {
  new: { src: `${JOBS_ICONS}/kpi-bi-people.svg`, bg: "#DFFFD3", leafWidth: 30, leafHeight: 30 },
  reviewing: { src: `${JOBS_ICONS}/kpi-video-people.svg`, bg: "#EAE2D9", leafWidth: 30, leafHeight: 30 },
  interviewing: { src: `${JOBS_ICONS}/kpi-people-call.svg`, bg: "#F5ECF9", leafWidth: 30, leafHeight: 30 },
  shortlisted: { src: `${JOBS_ICONS}/kpi-user-check.svg`, bg: "#D0FF79", leafWidth: 24.38, leafHeight: 26.88 },
  hired: { src: `${JOBS_ICONS}/kpi-check-ring.svg`, bg: "#FFEAD2", leafWidth: 25, leafHeight: 25 },
  rejected: { src: `${JOBS_ICONS}/kpi-usergroup-delete.svg`, bg: "#FFD7DC", leafWidth: 30, leafHeight: 30 },
  undecided: { src: `${JOBS_ICONS}/kpi-folder-people.svg`, bg: "#E2EEFF", leafWidth: 30, leafHeight: 30 },
  archived: { src: `${JOBS_ICONS}/kpi-wavy-check.svg`, bg: "#D5FFE5", leafWidth: 30, leafHeight: 30 },
};

const FALLBACK_STATUS_ICONS: KpiIcon[] = [
  { src: `${JOBS_ICONS}/kpi-reicon-people.svg`, bg: "#F9ECEC", leafWidth: 30, leafHeight: 30 },
  { src: `${JOBS_ICONS}/kpi-formkit-people.svg`, bg: "#ECE5FF", leafWidth: 28.13, leafHeight: 30 },
  { src: `${JOBS_ICONS}/kpi-star-badge.svg`, bg: "#CFFFDE", leafWidth: 27.2, leafHeight: 27.37 },
  { src: `${JOBS_ICONS}/kpi-shield-check.svg`, bg: "#FFF1E2", leafWidth: 30, leafHeight: 30 },
];

type StatusKpiRow = {
  id: string;
  name: string;
  systemKey: string | null;
  color: string | null;
  applicationCount?: number;
};

function statusCardHref(status: StatusKpiRow): string {
  return `${APPLICATIONS_HREF}?tab=${encodeURIComponent(status.id)}`;
}

function statusCardIcon(status: StatusKpiRow, index: number): KpiIcon {
  const mapped = status.systemKey ? STATUS_KPI_ICONS[status.systemKey] : undefined;
  const fallback = FALLBACK_STATUS_ICONS[index % FALLBACK_STATUS_ICONS.length];
  const icon = mapped ?? fallback;
  if (status.color && /^#([0-9a-f]{6})$/i.test(status.color)) {
    return { ...icon, bg: `${status.color}33` };
  }
  return icon;
}

type JobsDashboardProps = {
  jobs: JobListRow[];
  loading: boolean;
  tenantSlug: string | null;
  hotJobIds: Set<string>;
  totalCandidateCount?: number | null;
  onAddCandidate: (job: JobListRow) => void;
  onImportCandidates: (job: JobListRow) => void;
  onDelete: (jobId: string) => void;
  onArchive: (jobId: string) => void;
  onUnarchive: (jobId: string) => void;
};

function JobsKpiIcon({ src, bg, leafWidth, leafHeight }: KpiIcon) {
  return (
    <div
      className="flex size-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl p-1"
      style={{ backgroundColor: bg }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={leafWidth}
        height={leafHeight}
        className="shrink-0 object-contain"
        style={{ width: leafWidth, height: leafHeight }}
        aria-hidden
      />
    </div>
  );
}

function JobsKpiCard({ label, value, icon, href }: KpiCard) {
  return (
    <Link
      href={href}
      className="flex min-h-[80px] items-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-[14px] transition hover:border-[color:var(--brand-primary)] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-primary)]"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex w-full items-center gap-[14px]">
        <JobsKpiIcon {...icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-[Inter,sans-serif] text-xs font-semibold leading-4 text-[#374151]">{label}</p>
          <p className="font-[Inter,sans-serif] text-2xl font-semibold leading-8 text-black">{value}</p>
        </div>
      </div>
    </Link>
  );
}

function sumMetric(jobs: JobListRow[], pick: (job: JobListRow) => number): number {
  return jobs.reduce((total, job) => total + pick(job), 0);
}

function isActiveJob(job: JobListRow): boolean {
  return (
    normalizeJobRequisitionStatus(String(job.status ?? "")) === "published" && isJobRequisitionOpen(job)
  );
}

function buildSummaryCards(jobs: JobListRow[], totalCandidateCount?: number | null): KpiCard[] {
  const visible = jobs.filter(
    (job) => normalizeJobRequisitionStatus(String(job.status ?? "")) !== "archived"
  );
  const totalCandidates =
    typeof totalCandidateCount === "number" ? totalCandidateCount : sumMetric(visible, applicantCount);
  const strongMatches = sumMetric(visible, strongMatchCount);
  const onboarded = sumMetric(visible, hiredApplicantCount);

  return [
    {
      label: "Active Jobs",
      value: visible.filter(isActiveJob).length,
      href: JOBS_OPEN_HREF,
      icon: { src: `${JOBS_ICONS}/kpi-bag.svg`, bg: "#DFEBFF", leafWidth: 30, leafHeight: 30 },
    },
    {
      label: "Total Candidates",
      value: totalCandidates,
      href: CANDIDATES_HREF,
      icon: {
        src: `${JOBS_ICONS}/kpi-formkit-people.svg`,
        bg: "#ECE5FF",
        leafWidth: 28.13,
        leafHeight: 30,
      },
    },
    {
      label: "Strong Matches",
      value: strongMatches,
      href: `${APPLICATIONS_HREF}?matchScore=90_plus`,
      icon: { src: `${JOBS_ICONS}/kpi-star-badge.svg`, bg: "#CFFFDE", leafWidth: 27.2, leafHeight: 27.37 },
    },
    {
      label: "Onboarded",
      value: onboarded,
      href: `${APPLICATIONS_HREF}?tab=hired`,
      icon: { src: `${JOBS_ICONS}/kpi-shield-check.svg`, bg: "#FFF1E2", leafWidth: 30, leafHeight: 30 },
    },
  ];
}

function ShowMoreIcon() {
  return (
    <span className="relative size-4 shrink-0 overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${JOBS_ICONS}/loading-arc.svg`}
        alt=""
        width={13.33}
        height={13.33}
        className="absolute inset-[8.33%] size-[13.33px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${JOBS_ICONS}/loading-track.svg`}
        alt=""
        width={13.33}
        height={13.33}
        className="absolute inset-[8.33%] size-[13.33px]"
      />
    </span>
  );
}

function JobWorkspaceSearch({
  query,
  onQueryChange,
  className = "",
}: {
  query: string;
  onQueryChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex h-8 min-w-0 items-center gap-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white px-2.5 ${className}`}
    >
      <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${JOBS_ICONS}/search.svg`}
          alt=""
          width={16.67}
          height={16.67}
          className="size-[16.67px] shrink-0"
          aria-hidden
        />
      </span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by title of job"
        className="min-w-0 flex-1 bg-transparent font-[Inter,sans-serif] text-xs font-light leading-4 text-[#334155] outline-none placeholder:text-[#94A3B8]"
      />
    </label>
  );
}

function JobWorkspaceActions({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 ${className}`}>
      <Link href={JOBS_LISTING_HREF} className={JOBS_VIEW_ALL_BUTTON_CLASS}>
        View All Jobs
      </Link>
      <Link href={APPLICATIONS_HREF} className={JOBS_VIEW_ALL_BUTTON_CLASS}>
        View All Jobs Candidates
      </Link>
      <Link href={JOBS_NEW_HREF} className={JOBS_CREATE_BUTTON_CLASS}>
        Create a job
      </Link>
    </div>
  );
}

export function JobsDashboard({
  jobs,
  loading,
  tenantSlug,
  hotJobIds,
  totalCandidateCount = null,
  onAddCandidate,
  onImportCandidates,
  onDelete,
  onArchive,
  onUnarchive,
}: JobsDashboardProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(WORKSPACE_PAGE_SIZE);
  const [statusCards, setStatusCards] = useState<KpiCard[] | null>(null);
  const summaryCards = useMemo(
    () => buildSummaryCards(jobs, totalCandidateCount),
    [jobs, totalCandidateCount]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/application-statuses?activeOnly=1&includeCounts=1", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load statuses");
        if (cancelled) return;
        const statuses = ((payload.statuses ?? []) as StatusKpiRow[]).filter(
          (status) => status.systemKey !== "archived"
        );
        setStatusCards(
          statuses.map((status, index) => ({
            label: status.name,
            value: Number(status.applicationCount ?? 0),
            href: statusCardHref(status),
            icon: statusCardIcon(status, index),
          }))
        );
      } catch {
        if (!cancelled) setStatusCards([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const workspaceJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (normalizeJobRequisitionStatus(String(job.status ?? "")) === "archived") return false;
      if (!q) return true;
      return jobListDisplayTitle(job).toLowerCase().includes(q);
    });
  }, [jobs, query]);

  const visibleJobs = workspaceJobs.slice(0, visibleCount);
  const canShowMore = visibleJobs.length < workspaceJobs.length;

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
        Jobs Dashboard
      </h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <JobsKpiCard key={card.label} {...card} />
        ))}
      </div>

      {statusCards === null ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="min-h-[80px] animate-pulse rounded-lg border border-[#E5E7EB] bg-white p-[14px]"
            />
          ))}
        </div>
      ) : statusCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {statusCards.map((card) => (
            <JobsKpiCard key={card.href} {...card} />
          ))}
        </div>
      ) : null}

      <section className="flex w-full min-w-0 flex-col gap-5">
        <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden">
          {/* Mobile / tablet (< lg): title + search, then buttons */}
          <div className="flex w-full min-w-0 flex-col gap-3 lg:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="shrink-0 font-[Inter,sans-serif] text-lg font-semibold leading-7 text-black">
                Job Workspace
              </h2>
              <JobWorkspaceSearch
                query={query}
                onQueryChange={(value) => {
                  setQuery(value);
                  setVisibleCount(WORKSPACE_PAGE_SIZE);
                }}
                className="w-full sm:w-[274px] sm:shrink-0"
              />
            </div>
            <JobWorkspaceActions className="w-full sm:justify-end" />
          </div>

          {/* Laptop (lg – xl): row 1 title + search right; row 2 buttons right */}
          <div className="hidden w-full min-w-0 flex-col gap-3 lg:flex xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <h2 className="shrink-0 font-[Inter,sans-serif] text-lg font-semibold leading-7 text-black">
                Job Workspace
              </h2>
              <JobWorkspaceSearch
                query={query}
                onQueryChange={(value) => {
                  setQuery(value);
                  setVisibleCount(WORKSPACE_PAGE_SIZE);
                }}
                className="w-[274px] shrink-0"
              />
            </div>
            <JobWorkspaceActions className="w-full justify-end flex-nowrap" />
          </div>

          {/* Desktop web (xl+): single row — title | search + buttons */}
          <div className="hidden w-full min-w-0 items-center justify-between gap-3 xl:flex">
            <h2 className="shrink-0 font-[Inter,sans-serif] text-lg font-semibold leading-7 text-black">
              Job Workspace
            </h2>
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <JobWorkspaceSearch
                query={query}
                onQueryChange={(value) => {
                  setQuery(value);
                  setVisibleCount(WORKSPACE_PAGE_SIZE);
                }}
                className="w-[274px] shrink-0"
              />
              <JobWorkspaceActions className="shrink-0 flex-nowrap" />
            </div>
          </div>
        </div>

        <JobsGridView
          jobs={visibleJobs}
          loading={loading}
          emptyMessage={query.trim() ? "No jobs match that title." : "No jobs to show yet."}
          tenantSlug={tenantSlug}
          hotJobIds={hotJobIds}
          padded={false}
          onAddCandidate={onAddCandidate}
          onImportCandidates={onImportCandidates}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />

        {canShowMore ? (
          <div className="flex justify-center px-[14px]">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + WORKSPACE_PAGE_SIZE)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 font-[Inter,sans-serif] text-xs font-normal leading-4 text-[#374151] transition hover:bg-[#F8FAFC]"
            >
              Show more
              <ShowMoreIcon />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
