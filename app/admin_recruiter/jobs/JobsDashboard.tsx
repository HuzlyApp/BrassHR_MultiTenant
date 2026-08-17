"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import { JobsGridView } from "./JobsGridView";
import {
  analyzedApplicantCount,
  applicantCount,
  hiredApplicantCount,
  jobListDisplayTitle,
  newApplicantCount,
  readyToSubmitCount,
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
};

type JobsDashboardProps = {
  jobs: JobListRow[];
  loading: boolean;
  tenantSlug: string | null;
  hotJobIds: Set<string>;
  onAddCandidate: (job: JobListRow) => void;
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

function JobsKpiCard({ label, value, icon }: KpiCard) {
  return (
    <div className="flex min-h-[80px] items-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-[14px]">
      <div className="flex w-full items-center gap-[14px]">
        <JobsKpiIcon {...icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-[Inter,sans-serif] text-xs font-semibold leading-4 text-[#374151]">{label}</p>
          <p className="font-[Inter,sans-serif] text-2xl font-semibold leading-8 text-black">{value}</p>
        </div>
      </div>
    </div>
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

function buildKpiRows(jobs: JobListRow[]): { summary: KpiCard[]; pipeline: KpiCard[] } {
  const visible = jobs.filter(
    (job) => normalizeJobRequisitionStatus(String(job.status ?? "")) !== "archived"
  );
  const totalCandidates = sumMetric(visible, applicantCount);
  const newCandidates = sumMetric(visible, newApplicantCount);
  const strongMatches = sumMetric(visible, strongMatchCount);
  const onboarded = sumMetric(visible, hiredApplicantCount);
  const readyForScreening = sumMetric(visible, analyzedApplicantCount);
  const approvedUploadPortal = sumMetric(visible, readyToSubmitCount);

  return {
    summary: [
      {
        label: "Active Jobs",
        value: visible.filter(isActiveJob).length,
        icon: { src: `${JOBS_ICONS}/kpi-bag.svg`, bg: "#DFEBFF", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Total Candidates",
        value: totalCandidates,
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
        icon: { src: `${JOBS_ICONS}/kpi-star-badge.svg`, bg: "#CFFFDE", leafWidth: 27.2, leafHeight: 27.37 },
      },
      {
        label: "Onboarded",
        value: onboarded,
        icon: { src: `${JOBS_ICONS}/kpi-shield-check.svg`, bg: "#FFF1E2", leafWidth: 30, leafHeight: 30 },
      },
    ],
    pipeline: [
      {
        label: "My Candidates",
        value: totalCandidates,
        icon: { src: `${JOBS_ICONS}/kpi-reicon-people.svg`, bg: "#F9ECEC", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "New Candidates",
        value: newCandidates,
        icon: { src: `${JOBS_ICONS}/kpi-bi-people.svg`, bg: "#DFFFD3", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Ready for screening",
        value: readyForScreening,
        icon: { src: `${JOBS_ICONS}/kpi-video-people.svg`, bg: "#EAE2D9", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Ready for 2nd Interview",
        value: 0,
        icon: { src: `${JOBS_ICONS}/kpi-people-call.svg`, bg: "#F5ECF9", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Approved Upload Portal",
        value: approvedUploadPortal,
        icon: { src: `${JOBS_ICONS}/kpi-user-check.svg`, bg: "#D0FF79", leafWidth: 24.38, leafHeight: 26.88 },
      },
      {
        label: "Submitted For MSP Review",
        value: 0,
        icon: { src: `${JOBS_ICONS}/kpi-folder-people.svg`, bg: "#E2EEFF", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Approved by MSP",
        value: 0,
        icon: { src: `${JOBS_ICONS}/kpi-wavy-check.svg`, bg: "#D5FFE5", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Rejected at MSP Screening",
        value: 0,
        icon: { src: `${JOBS_ICONS}/kpi-usergroup-delete.svg`, bg: "#FFD7DC", leafWidth: 30, leafHeight: 30 },
      },
      {
        label: "Selected by MSP Client",
        value: 0,
        icon: { src: `${JOBS_ICONS}/kpi-check-ring.svg`, bg: "#FFEAD2", leafWidth: 25, leafHeight: 25 },
      },
    ],
  };
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

export function JobsDashboard({
  jobs,
  loading,
  tenantSlug,
  hotJobIds,
  onAddCandidate,
  onDelete,
  onArchive,
  onUnarchive,
}: JobsDashboardProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(WORKSPACE_PAGE_SIZE);
  const kpis = useMemo(() => buildKpiRows(jobs), [jobs]);

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
        {kpis.summary.map((card) => (
          <JobsKpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.pipeline.map((card) => (
          <JobsKpiCard key={card.label} {...card} />
        ))}
      </div>

      <section className="flex w-full min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-[Inter,sans-serif] text-lg font-semibold leading-7 text-black">Job Workspace</h2>
          <div className="flex items-center gap-5">
            <label className="flex h-8 w-full items-center gap-1 overflow-hidden rounded-lg border border-[#CBD5E1] bg-white px-2.5 sm:w-[274px]">
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
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisibleCount(WORKSPACE_PAGE_SIZE);
                }}
                placeholder="Search by title of job"
                className="min-w-0 flex-1 bg-transparent font-[Inter,sans-serif] text-xs font-light leading-4 text-[#334155] outline-none placeholder:text-[#94A3B8]"
              />
            </label>
            <Link
              href="/admin_recruiter/jobs?view=all"
              className="shrink-0 font-[Inter,sans-serif] text-xs font-normal leading-4 text-[#012352] underline"
            >
              View All
            </Link>
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
