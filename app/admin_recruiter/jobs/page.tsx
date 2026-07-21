"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Columns2, Filter, Plus, Star } from "lucide-react";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_SUBTITLE_STYLE,
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
  CANDIDATES_PAGE_SUBTITLE_CLASS,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  DEFAULT_JOB_COLUMNS,
  JOB_COLUMN_OPTIONS,
  jobColumnLabel,
  jobListColumnClassName,
  loadJobColumnOrder,
  saveJobColumnOrder,
  type JobColumnId,
} from "./job-columns";
import {
  jobDisplayId,
  jobLocation,
  renderJobListCell,
  type JobListCellContext,
  type JobListRow,
} from "./render-job-list-cell";

type JobTab = "all" | "active" | "expiring" | "pending" | "inactive";

const JOB_TABS: Array<{ id: JobTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "expiring", label: "Expiring" },
  { id: "pending", label: "Pending" },
  { id: "inactive", label: "Inactive" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Figma form fields: 8px radius, #CBD5E1 border, white background */
const JOBS_FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white";

const JOBS_TOOLBAR_BUTTON_CLASS = `${JOBS_FORM_SURFACE_CLASS} inline-flex h-8 items-center gap-1.5 px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50`;

const JOBS_FILTER_CONTROL_CLASS = `${JOBS_FORM_SURFACE_CLASS} h-10 w-full min-w-0 px-2.5 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 sm:h-8 sm:min-w-[100px] sm:max-w-[160px] sm:w-auto appearance-auto cursor-pointer`;

const JOBS_POST_JOB_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-normal leading-5 text-[#525252] transition hover:bg-zinc-50";

/** Figma Analytics/icon/Yellow-500 */
const JOBS_STAR_ICON_COLOR = "#EAB308";

function isExpiringSoon(deadline: string | null): boolean {
  if (!deadline) return false;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 14;
}

function matchesJobTab(job: JobListRow, tab: JobTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "active":
      return job.status === "published";
    case "expiring":
      return job.status === "published" && isExpiringSoon(job.application_deadline);
    case "pending":
      return job.status === "draft";
    case "inactive":
      return job.status === "closed" || job.status === "archived";
    default:
      return true;
  }
}

function JobsFilterSearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      className={JOBS_FILTER_CONTROL_CLASS}
      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
    />
  );
}

function JobsFilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={`${JOBS_FILTER_CONTROL_CLASS} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`}
      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

const JOB_ACTIONS_MENU_WIDTH = 140;
const JOB_ACTIONS_MENU_ESTIMATED_HEIGHT = 168;

function JobActionsMenuPortal({
  job,
  anchor,
  onClose,
  onTransition,
}: {
  job: JobListRow;
  anchor: HTMLElement;
  onClose: () => void;
  onTransition: (jobId: string, action: "unpublish" | "close" | "archive") => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + JOB_ACTIONS_MENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - JOB_ACTIONS_MENU_ESTIMATED_HEIGHT - 4);
    }
    setStyle({
      position: "fixed",
      top,
      left: Math.max(8, rect.right - JOB_ACTIONS_MENU_WIDTH),
      width: JOB_ACTIONS_MENU_WIDTH,
      visibility: "visible",
    });
  }, [anchor]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchor.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [anchor, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={style}
      className={`z-[200] min-w-[140px] ${JOBS_FORM_SURFACE_CLASS} py-1 shadow-lg`}
    >
      {(job.status === "draft" || job.status === "published") ? (
        <Link
          href={`/admin_recruiter/jobs/${job.id}/edit`}
          role="menuitem"
          className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
          onClick={onClose}
        >
          Edit
        </Link>
      ) : null}
      {job.status === "published" ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTransition(job.id, "unpublish");
              onClose();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
          >
            Unpublish
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTransition(job.id, "close");
              onClose();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
          >
            Close
          </button>
        </>
      ) : null}
      {job.status !== "archived" ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onTransition(job.id, "archive");
            onClose();
          }}
          className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
        >
          Archive
        </button>
      ) : null}
    </div>,
    document.body
  );
}

export default function AdminRecruiterJobsPage() {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding);

  const [jobs, setJobs] = useState<JobListRow[]>([]);
  const [jobTab, setJobTab] = useState<JobTab>("all");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [listColumnOrder, setListColumnOrder] = useState<JobColumnId[]>(DEFAULT_JOB_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [openActionsMenu, setOpenActionsMenu] = useState<{
    job: JobListRow;
    anchor: HTMLElement;
  } | null>(null);

  const [jobIdFilter, setJobIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [postedByFilter, setPostedByFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
      setJobs(payload.jobs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setListColumnOrder(loadJobColumnOrder());
  }, []);

  useEffect(() => {
    setPage(1);
  }, [jobTab, jobIdFilter, statusFilter, titleFilter, locationFilter, assigneeFilter, postedByFilter, pageSize]);

  async function transition(jobId: string, action: "unpublish" | "close" | "archive") {
    const response = await fetch("/api/admin/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Failed to update job");
      return;
    }
    setOpenActionsMenu(null);
    await load();
  }

  const tabCounts = useMemo(() => {
    const counts: Record<JobTab, number> = {
      all: jobs.length,
      active: 0,
      expiring: 0,
      pending: 0,
      inactive: 0,
    };
    for (const job of jobs) {
      if (matchesJobTab(job, "active")) counts.active += 1;
      if (matchesJobTab(job, "expiring")) counts.expiring += 1;
      if (matchesJobTab(job, "pending")) counts.pending += 1;
      if (matchesJobTab(job, "inactive")) counts.inactive += 1;
    }
    return counts;
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!matchesJobTab(job, jobTab)) return false;

      const idQuery = jobIdFilter.trim().toLowerCase();
      if (idQuery && !jobDisplayId(job).toLowerCase().includes(idQuery)) return false;

      if (statusFilter && job.status !== statusFilter) return false;

      const titleQuery = titleFilter.trim().toLowerCase();
      if (titleQuery && !(job.public_title || "").toLowerCase().includes(titleQuery)) return false;

      if (locationFilter && jobLocation(job) !== locationFilter) return false;

      if (assigneeFilter && assigneeFilter !== "HR Manager") return false;

      if (postedByFilter && postedByFilter !== "HR Manager") return false;

      return true;
    });
  }, [jobs, jobTab, jobIdFilter, statusFilter, titleFilter, locationFilter, assigneeFilter, postedByFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredJobs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredJobs.length);
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const loc = jobLocation(job);
      if (loc && loc !== "—") values.add(loc);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const listColumns = listColumnOrder.length ? listColumnOrder : DEFAULT_JOB_COLUMNS;

  const jobListCellContext = useMemo((): JobListCellContext => {
    return {
      brandingSecondaryHex: branding.secondaryHex,
      starredIds,
      onToggleStar: (jobId) => {
        setStarredIds((current) => {
          const next = new Set(current);
          if (next.has(jobId)) next.delete(jobId);
          else next.add(jobId);
          return next;
        });
      },
      openActionsJobId: openActionsMenu?.job.id ?? null,
      onOpenActionsMenu: (job, anchor) => {
        setOpenActionsMenu((current) => (current?.job.id === job.id ? null : { job, anchor }));
      },
    };
  }, [branding.secondaryHex, starredIds, openActionsMenu?.job.id]);

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8" style={brandStyle}>
      {/* Title + tabs sit outside the white card (Figma) */}
      <div className="mb-4">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Jobs
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Manage jobs posting in one place
        </p>
      </div>

      <nav className="mb-4 w-full min-w-0" aria-label="Jobs navigation">
        <div className="flex w-full min-w-0 flex-nowrap items-start justify-center gap-[20px] overflow-x-auto py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {JOB_TABS.map((tab) => {
            const active = jobTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setJobTab(tab.id)}
                className={`inline-flex shrink-0 flex-col items-center px-0 py-0 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                  active
                    ? "text-[color:var(--brand-primary)]"
                    : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="flex items-center gap-2">
                  <span>{tab.label}</span>
                  <span
                    className="inline-flex aspect-square h-4 w-4 flex-col items-center justify-center gap-2 rounded-sm bg-[#CFCAC2] p-0.5 text-[10px] font-medium leading-none text-[#2B3D51]"
                  >
                    {tabCounts[tab.id]}
                  </span>
                </span>
                <span
                  className={`mt-2 block h-0.5 w-full rounded-full ${
                    active ? "bg-[color:var(--brand-primary)]" : "bg-transparent"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </nav>

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <div className="flex w-full flex-col gap-0 rounded-t-[12px] bg-white">
          <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-t-[12px] bg-white px-[14px] py-3">
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((value) => !value)}
                aria-expanded={showFilterRows}
                className={`${JOBS_TOOLBAR_BUTTON_CLASS} ${
                  showFilterRows
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
                    : ""
                }`}
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Filter className="h-4 w-4 shrink-0" />
                Filters
              </button>
              <button
                type="button"
                onClick={() => setEditColumnsOpen(true)}
                className={JOBS_TOOLBAR_BUTTON_CLASS}
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Columns2 className="h-4 w-4 shrink-0" />
                Columns
              </button>
            </div>

            <Link href="/admin_recruiter/jobs/new" className={JOBS_POST_JOB_BUTTON_CLASS}>
              <Plus
                className="h-5 w-5 shrink-0"
                style={{ color: branding.secondaryHex }}
                strokeWidth={2}
                aria-hidden
              />
              Post a job
            </Link>
          </div>

          <div className="border-b border-[#E5E7EB]" aria-hidden />

          {showFilterRows ? (
          <div className="flex w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-[#E5E7EB] px-[14px] py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <JobsFilterSearch label="Job Id" value={jobIdFilter} onChange={setJobIdFilter} />
                <JobsFilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                  <option value="archived">Archived</option>
                </JobsFilterSelect>
                <JobsFilterSearch label="Title" value={titleFilter} onChange={setTitleFilter} />
                <JobsFilterSelect label="Location" value={locationFilter} onChange={setLocationFilter}>
                  {locationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </JobsFilterSelect>
                <JobsFilterSelect label="Assignee" value={assigneeFilter} onChange={setAssigneeFilter}>
                  <option value="HR Manager">HR Manager</option>
                </JobsFilterSelect>
                <JobsFilterSelect label="Posted by" value={postedByFilter} onChange={setPostedByFilter}>
                  <option value="HR Manager">HR Manager</option>
                </JobsFilterSelect>

                <div className="flex shrink-0 items-center gap-2">
                  <Star
                    className="h-4 w-4 shrink-0"
                    style={{ color: JOBS_STAR_ICON_COLOR }}
                    fill={JOBS_STAR_ICON_COLOR}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap text-sm font-medium text-[#334155]">
                    {filteredJobs.length} results
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-[14px] mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium uppercase tracking-wide text-[#64748B]">
              <tr>
                {listColumns.map((colId) => (
                  <th
                    key={colId}
                    className={`border-r border-[#E5E7EB] px-[14px] py-3 font-medium normal-case tracking-normal last:border-r-0 ${jobListColumnClassName(colId)}`}
                  >
                    {jobColumnLabel(colId)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td colSpan={listColumns.length} className="px-[14px] py-12 text-center text-[#64748B]">
                    Loading jobs…
                  </td>
                </tr>
              ) : paginatedJobs.length === 0 ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td colSpan={listColumns.length} className="px-[14px] py-12 text-center text-[#64748B]">
                    No jobs match these filters.
                  </td>
                </tr>
              ) : (
                paginatedJobs.map((job) => (
                  <tr key={job.id} className="border-b border-[#E9EDF3] align-middle hover:bg-[#FAFBFC]">
                    {listColumns.map((colId) => (
                      <td
                        key={colId}
                        className={`border-r border-[#EEF2F7] px-[14px] py-4 align-middle last:border-r-0 ${jobListColumnClassName(colId)}`}
                      >
                        {renderJobListCell(colId, job, jobListCellContext)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 rounded-b-[12px] border-t border-[#E5E7EB] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#64748B]">
            Showing {pageStart}-{pageEnd} of {filteredJobs.length} results
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[#64748B]">
              Show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`h-8 px-2 text-sm text-[#334155] ${JOBS_FORM_SURFACE_CLASS}`}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className={`inline-flex h-8 items-center gap-1 px-2.5 text-sm text-[#334155] disabled:cursor-not-allowed disabled:opacity-50 ${JOBS_FORM_SURFACE_CLASS}`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => {
                const active = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex h-8 min-w-8 items-center justify-center px-2 text-sm ${
                      active
                        ? "rounded-lg border-transparent text-white"
                        : "text-[#334155] hover:bg-[#F8FAFC]"
                    } ${active ? "" : JOBS_FORM_SURFACE_CLASS}`}
                    style={active ? { backgroundColor: branding.secondaryHex } : undefined}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
                className={`inline-flex h-8 items-center gap-1 px-2.5 text-sm text-[#334155] disabled:cursor-not-allowed disabled:opacity-50 ${JOBS_FORM_SURFACE_CLASS}`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {openActionsMenu ? (
        <JobActionsMenuPortal
          job={openActionsMenu.job}
          anchor={openActionsMenu.anchor}
          onClose={() => setOpenActionsMenu(null)}
          onTransition={(jobId, action) => void transition(jobId, action)}
        />
      ) : null}

      <ColumnsEditorModal
        key={editColumnsOpen ? "job-cols-open" : "job-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={JOB_COLUMN_OPTIONS}
        value={listColumnOrder}
        title="Edit Columns"
        description="Choose which columns appear in the jobs list and drag to reorder them."
        onSave={(order) => {
          setListColumnOrder(order);
          saveJobColumnOrder(order);
        }}
      />
    </div>
  );
}
