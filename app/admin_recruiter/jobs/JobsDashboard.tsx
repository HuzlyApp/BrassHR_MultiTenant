"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  FilterChipInput,
  type FilterChipInputHandle,
} from "@/app/admin_recruiter/components/FilterChipInput";
import { jobMatchesDashboardSearchTags } from "@/lib/jobs/jobs-list-search";
import { isJobRequisitionOpen } from "@/lib/jobs/public-application-routing";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import { JobsGridView, JOBS_GRID_INFINITE_PAGE_SIZE } from "./JobsGridView";
import { JobsCardBulkSelectHeader } from "./JobsCardBulkSelectHeader";
import { JobsBulkSelectionSnackbar } from "./JobsBulkSelectionSnackbar";
import {
  applicantCount,
  hiredApplicantCount,
  strongMatchCount,
  type JobListRow,
} from "./render-job-list-cell";

const JOBS_ICONS = "/icons/jobs-icons";
const KPI_TOGGLE_BUTTON_CLASS =
  "inline-flex items-center gap-1 bg-transparent px-1 py-1 font-[Inter,sans-serif] text-xs font-semibold leading-[18px] text-[color:var(--brand-primary)] transition hover:opacity-80";

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
  "inline-flex h-8 w-full shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-primary)] bg-white px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-[color:var(--brand-primary)] no-underline transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_6%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_30%,transparent)] sm:w-auto";

const JOBS_CREATE_BUTTON_CLASS =
  "inline-flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-[color:var(--brand-primary)] px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-white no-underline transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary)_35%,transparent)] sm:w-auto";

const PRIMARY_SEARCH_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-primary)] px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50";

const OUTLINE_SEARCH_BUTTON_CLASS =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 font-[Inter,sans-serif] text-xs font-semibold leading-4 text-[#475569] transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

const VIEW_ALL_LINK_CLASS =
  "font-[Inter,sans-serif] text-sm font-semibold leading-5 text-[color:var(--brand-primary)] no-underline transition hover:opacity-80";

function tagsKey(tags: string[]): string {
  return tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean).join("|");
}

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
  selectedIds: Set<string>;
  onToggleSelect: (jobId: string) => void;
  onSelectAll: (jobIds: string[]) => void;
  onClearSelection: () => void;
  selectedPublishedCount: number;
  selectedArchivableCount: number;
  archiveBusy?: boolean;
  deleteBusy?: boolean;
  exportDisabled?: boolean;
  onBulkUnpublish: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onExportCsv: () => void;
  onExportXls: () => void;
  onImportFromMsp: () => void;
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
    normalizeJobRequisitionStatus(String(job.status ?? "")) === "open" && isJobRequisitionOpen(job)
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
      href: `${APPLICATIONS_HREF}?matchScore=90_100`,
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

function SearchGlyph() {
  return (
    <span className="relative flex size-5 shrink-0 items-center justify-center overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${JOBS_ICONS}/search.svg`}
        alt=""
        width={16.67}
        height={16.67}
        className="size-[16.67px] shrink-0"
      />
    </span>
  );
}

function ResetSearchGlyph() {
  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/candidates-icons/reset-search.svg"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0"
      />
    </span>
  );
}

/** Tag-based dashboard search (title, skills, experience, location, profession). No separate skills field. */
function JobWorkspaceSearchBar({
  draftTags,
  appliedTags,
  onDraftTagsChange,
  onApplySearch,
  onResetSearch,
}: {
  draftTags: string[];
  appliedTags: string[];
  onDraftTagsChange: (tags: string[]) => void;
  onApplySearch: (tags: string[]) => void;
  onResetSearch: () => void;
}) {
  const chipRef = useRef<FilterChipInputHandle>(null);
  const [draftText, setDraftText] = useState("");
  const searchDirty = tagsKey(draftTags) !== tagsKey(appliedTags);
  const hasAppliedSearch = appliedTags.length > 0;
  const hasDraftSearch = draftTags.length > 0 || Boolean(draftText.trim());

  function runSearch() {
    const tags = chipRef.current?.commitDraft() ?? draftTags;
    onApplySearch(tags);
  }

  function handleReset() {
    chipRef.current?.clearDraft();
    setDraftText("");
    onResetSearch();
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
      <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 sm:px-3">
        <SearchGlyph />
        <FilterChipInput
          ref={chipRef}
          embedded
          values={draftTags}
          placeholder="Search by job title, skills, experience, location..."
          aria-label="Search by job title, skills, experience, location, and profession"
          onChange={onDraftTagsChange}
          onDraftTextChange={setDraftText}
          onEnterSubmit={(nextTags) => {
            onDraftTagsChange(nextTags);
            onApplySearch(nextTags);
          }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={runSearch}
          disabled={!searchDirty && !hasDraftSearch}
          className={`${PRIMARY_SEARCH_BUTTON_CLASS} flex-1 sm:flex-none`}
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasAppliedSearch && !hasDraftSearch}
          className={`${OUTLINE_SEARCH_BUTTON_CLASS} flex-1 sm:flex-none`}
        >
          <ResetSearchGlyph />
          Reset search
        </button>
      </div>
    </div>
  );
}

function JobWorkspaceActions({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 ${className}`}>
      <Link href={JOBS_NEW_HREF} className={JOBS_CREATE_BUTTON_CLASS}>
        <span aria-hidden>+</span>
        Create a job
      </Link>
      <Link href={JOBS_LISTING_HREF} className={JOBS_VIEW_ALL_BUTTON_CLASS}>
        View All Jobs
      </Link>
      <Link href={APPLICATIONS_HREF} className={JOBS_VIEW_ALL_BUTTON_CLASS}>
        View Candidates
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
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  selectedPublishedCount,
  selectedArchivableCount,
  archiveBusy = false,
  deleteBusy = false,
  exportDisabled = false,
  onBulkUnpublish,
  onBulkArchive,
  onBulkDelete,
  onExportCsv,
  onExportXls,
  onImportFromMsp,
  onAddCandidate,
  onImportCandidates,
  onDelete,
  onArchive,
  onUnarchive,
}: JobsDashboardProps) {
  const [draftSearchTags, setDraftSearchTags] = useState<string[]>([]);
  const [appliedSearchTags, setAppliedSearchTags] = useState<string[]>([]);
  const [kpiCardsExpanded, setKpiCardsExpanded] = useState(false);
  const [statusCards, setStatusCards] = useState<KpiCard[] | null>(null);
  const [cardBulkSelectMode, setCardBulkSelectMode] = useState(false);
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
    return jobs.filter((job) => {
      if (normalizeJobRequisitionStatus(String(job.status ?? "")) === "archived") return false;
      return jobMatchesDashboardSearchTags(job, appliedSearchTags);
    });
  }, [jobs, appliedSearchTags]);

  const workspaceSelectedCount = useMemo(() => {
    let count = 0;
    for (const job of workspaceJobs) {
      if (selectedIds.has(job.id)) count += 1;
    }
    return count;
  }, [workspaceJobs, selectedIds]);

  const allWorkspaceSelected =
    workspaceJobs.length > 0 && workspaceJobs.every((job) => selectedIds.has(job.id));
  const someWorkspaceSelected = workspaceJobs.some((job) => selectedIds.has(job.id));

  const hasStatusKpiCards = statusCards !== null && statusCards.length > 0;
  const showKpiToggle = hasStatusKpiCards;

  function applySearch(tags: string[]) {
    const normalized = tags.map((tag) => tag.trim()).filter(Boolean);
    setDraftSearchTags(normalized);
    setAppliedSearchTags(normalized);
  }

  function resetSearch() {
    setDraftSearchTags([]);
    setAppliedSearchTags([]);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <h1 className={`${CANDIDATES_PAGE_TITLE_CLASS} shrink-0`} style={CANDIDATES_PAGE_TITLE_STYLE}>
        Jobs Dashboard
      </h1>

      <div className="flex w-full min-w-0 flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <JobsKpiCard key={card.label} {...card} />
          ))}
        </div>

        {showKpiToggle ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setKpiCardsExpanded((expanded) => !expanded)}
              className={KPI_TOGGLE_BUTTON_CLASS}
              aria-expanded={kpiCardsExpanded}
            >
              {kpiCardsExpanded ? "Show less" : "Show more"}
              {kpiCardsExpanded ? (
                <ChevronUp className="size-4 shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0" aria-hidden />
              )}
            </button>
          </div>
        ) : null}

        {kpiCardsExpanded ? (
          statusCards === null ? (
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
          ) : null
        ) : null}
      </div>

      <section className="flex w-full min-w-0 flex-col gap-4">
        <JobWorkspaceSearchBar
          draftTags={draftSearchTags}
          appliedTags={appliedSearchTags}
          onDraftTagsChange={setDraftSearchTags}
          onApplySearch={applySearch}
          onResetSearch={resetSearch}
        />

        <JobWorkspaceActions className="w-full" />

        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <h2 className="shrink-0 font-[Inter,sans-serif] text-lg font-semibold leading-7 text-black">
            Job Workspace
          </h2>
          <Link href={JOBS_LISTING_HREF} className={VIEW_ALL_LINK_CLASS}>
            View all
          </Link>
        </div>

        {cardBulkSelectMode ? (
          <JobsBulkSelectionSnackbar
            totalSelectedCount={workspaceSelectedCount}
            unpublishDisabled={selectedPublishedCount === 0}
            archiveDisabled={archiveBusy || selectedArchivableCount === 0}
            exportDisabled={exportDisabled}
            busy={archiveBusy || deleteBusy}
            onUnpublish={onBulkUnpublish}
            onArchive={onBulkArchive}
            onDelete={onBulkDelete}
            onExportCsv={onExportCsv}
            onExportXls={onExportXls}
            onImportFromMsp={onImportFromMsp}
            onClear={onClearSelection}
          />
        ) : null}

        <JobsCardBulkSelectHeader
          bulkSelectEnabled={cardBulkSelectMode}
          onBulkSelectEnabledChange={(enabled) => {
            setCardBulkSelectMode(enabled);
            if (!enabled) onClearSelection();
          }}
          selectAllChecked={allWorkspaceSelected}
          selectAllIndeterminate={someWorkspaceSelected && !allWorkspaceSelected}
          selectAllDisabled={workspaceJobs.length === 0}
          onSelectAllChange={() => {
            if (allWorkspaceSelected) {
              onSelectAll([]);
              return;
            }
            onSelectAll(workspaceJobs.map((job) => job.id));
          }}
        />

        <JobsGridView
          jobs={workspaceJobs}
          loading={loading}
          emptyMessage={
            appliedSearchTags.length > 0 ? "No jobs match your search." : "No jobs to show yet."
          }
          tenantSlug={tenantSlug}
          hotJobIds={hotJobIds}
          padded={false}
          infiniteScrollPageSize={JOBS_GRID_INFINITE_PAGE_SIZE}
          selectedIds={selectedIds}
          selectionMode={cardBulkSelectMode}
          onToggleSelect={cardBulkSelectMode ? onToggleSelect : undefined}
          onAddCandidate={onAddCandidate}
          onImportCandidates={onImportCandidates}
          onDelete={onDelete}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
        />
      </section>
    </div>
  );
}
