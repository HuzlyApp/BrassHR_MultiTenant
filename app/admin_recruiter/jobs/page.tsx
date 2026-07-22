"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Columns2, Filter, Plus } from "lucide-react";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
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
  isSortableJobColumn,
  loadJobColumnOrder,
  saveJobColumnOrder,
  type JobColumnId,
  type JobSortField,
} from "./job-columns";
import {
  jobDisplayId,
  jobLocation,
  jobStatusSortLabel,
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

const JOBS_STAR_FILLED_SRC = "/icons/jobs-icons/Star-filled.svg";
const JOB_SORT_ICON_SRC = "/sort-icon.svg";

type SortDirection = "asc" | "desc";

function JobTableSortHeader({
  colId,
  sortField,
  sortDirection,
  onToggleSort,
}: {
  colId: JobSortField;
  sortField: JobSortField | null;
  sortDirection: SortDirection;
  onToggleSort: (field: JobSortField) => void;
}) {
  const isActive = sortField === colId;

  return (
    <button
      type="button"
      onClick={() => onToggleSort(colId)}
      className={`inline-flex items-center gap-1.5 font-medium normal-case tracking-normal text-[#64748B] transition hover:text-[#334155] ${
        colId === "jobStatus" ? "mx-auto" : ""
      }`}
      aria-label={`Sort by ${jobColumnLabel(colId)}${
        isActive ? `, ${sortDirection === "asc" ? "ascending" : "descending"}` : ""
      }`}
    >
      <span>{jobColumnLabel(colId)}</span>
      <img src={JOB_SORT_ICON_SRC} width={12} height={12} className="h-3 w-3 shrink-0" alt="" aria-hidden />
    </button>
  );
}

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

const JOBS_FILTER_SELECT_CLASS = `${JOBS_FORM_SURFACE_CLASS} h-10 w-full min-w-0 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 sm:h-8 sm:min-w-[100px] sm:max-w-[160px] sm:w-auto`;

/** Native select chevron — inset from the right edge for even padding. */
const JOBS_FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

const JOBS_FILTER_GRID_CONTROL_CLASS = `${JOBS_FORM_SURFACE_CLASS} h-10 w-full min-w-0 px-2.5 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 appearance-auto cursor-pointer`;

const JOBS_FILTER_GRID_SELECT_CLASS = `${JOBS_FILTER_GRID_CONTROL_CLASS} appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat pr-8`;

function CompactFilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium leading-4 text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

function MobileIconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50"
    >
      {children}
    </button>
  );
}

function JobsFiltersToggleButton({
  active,
  hasActiveFilters,
  onClick,
  className = "",
}: {
  active: boolean;
  hasActiveFilters: boolean;
  onClick: () => void;
  className?: string;
}) {
  const isOn = active || hasActiveFilters;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`inline-flex h-10 w-auto shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap transition sm:h-8 sm:px-3 sm:text-sm ${
        isOn
          ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
          : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
      } ${className}`}
    >
      <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden min-[480px]:inline">Filters</span>
    </button>
  );
}

function JobsFilterSelect({
  label,
  value,
  onChange,
  children,
  variant = "inline",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  variant?: "inline" | "grid";
}) {
  const controlClass =
    variant === "grid"
      ? `${JOBS_FILTER_GRID_SELECT_CLASS} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`
      : `${JOBS_FILTER_SELECT_CLASS} ${value ? "text-[#334155]" : "text-[#94A3B8]"}`;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={controlClass}
      style={{ ...CANDIDATES_PAGE_SUBTITLE_STYLE, ...JOBS_FILTER_SELECT_CHEVRON }}
    >
      <option value="">{label}</option>
      {children}
    </select>
  );
}

type JobsFilterFieldsProps = {
  variant: "grid" | "inline";
  jobIdFilter: string;
  onJobIdFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  titleFilter: string;
  onTitleFilterChange: (value: string) => void;
  locationFilter: string;
  onLocationFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  postedByFilter: string;
  onPostedByFilterChange: (value: string) => void;
  locationOptions: string[];
  resultsCount?: number;
};

function JobsFilterSearchField({
  label,
  value,
  onChange,
  variant = "inline",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variant?: "inline" | "grid";
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      aria-label={label}
      className={variant === "grid" ? JOBS_FILTER_GRID_CONTROL_CLASS : JOBS_FILTER_CONTROL_CLASS}
      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
    />
  );
}

function JobsFilterFields({
  variant,
  jobIdFilter,
  onJobIdFilterChange,
  statusFilter,
  onStatusFilterChange,
  titleFilter,
  onTitleFilterChange,
  locationFilter,
  onLocationFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  postedByFilter,
  onPostedByFilterChange,
  locationOptions,
  resultsCount,
}: JobsFilterFieldsProps) {
  const fields = (
    <>
      <JobsFilterSearchField
        label="Job Id"
        value={jobIdFilter}
        onChange={onJobIdFilterChange}
        variant={variant}
      />
      <JobsFilterSelect
        label="Status"
        value={statusFilter}
        onChange={onStatusFilterChange}
        variant={variant}
      >
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="closed">Closed</option>
        <option value="archived">Archived</option>
      </JobsFilterSelect>
      <JobsFilterSearchField
        label="Title"
        value={titleFilter}
        onChange={onTitleFilterChange}
        variant={variant}
      />
      <JobsFilterSelect
        label="Location"
        value={locationFilter}
        onChange={onLocationFilterChange}
        variant={variant}
      >
        {locationOptions.map((location) => (
          <option key={location} value={location}>
            {location}
          </option>
        ))}
      </JobsFilterSelect>
      <JobsFilterSelect
        label="Assignee"
        value={assigneeFilter}
        onChange={onAssigneeFilterChange}
        variant={variant}
      >
        <option value="HR Manager">HR Manager</option>
      </JobsFilterSelect>
      <JobsFilterSelect
        label="Posted by"
        value={postedByFilter}
        onChange={onPostedByFilterChange}
        variant={variant}
      >
        <option value="HR Manager">HR Manager</option>
      </JobsFilterSelect>
    </>
  );

  if (variant === "grid") {
    return (
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 min-[600px]:grid-cols-2 lg:grid-cols-3">
        <CompactFilterField label="Job Id">
          <JobsFilterSearchField
            label="Job Id"
            value={jobIdFilter}
            onChange={onJobIdFilterChange}
            variant="grid"
          />
        </CompactFilterField>
        <CompactFilterField label="Status">
          <JobsFilterSelect
            label="Status"
            value={statusFilter}
            onChange={onStatusFilterChange}
            variant="grid"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </JobsFilterSelect>
        </CompactFilterField>
        <CompactFilterField label="Title">
          <JobsFilterSearchField
            label="Title"
            value={titleFilter}
            onChange={onTitleFilterChange}
            variant="grid"
          />
        </CompactFilterField>
        <CompactFilterField label="Location">
          <JobsFilterSelect
            label="Location"
            value={locationFilter}
            onChange={onLocationFilterChange}
            variant="grid"
          >
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </JobsFilterSelect>
        </CompactFilterField>
        <CompactFilterField label="Assignee">
          <JobsFilterSelect
            label="Assignee"
            value={assigneeFilter}
            onChange={onAssigneeFilterChange}
            variant="grid"
          >
            <option value="HR Manager">HR Manager</option>
          </JobsFilterSelect>
        </CompactFilterField>
        <CompactFilterField label="Posted by">
          <JobsFilterSelect
            label="Posted by"
            value={postedByFilter}
            onChange={onPostedByFilterChange}
            variant="grid"
          >
            <option value="HR Manager">HR Manager</option>
          </JobsFilterSelect>
        </CompactFilterField>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      {fields}
      {typeof resultsCount === "number" ? (
        <div className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={JOBS_STAR_FILLED_SRC}
            alt=""
            width={14}
            height={14}
            className="h-[14px] w-[14px] shrink-0"
            aria-hidden
          />
          <span className="whitespace-nowrap text-sm font-medium text-[#334155]">
            {resultsCount} results
          </span>
        </div>
      ) : null}
    </div>
  );
}

const JOB_ACTIONS_MENU_WIDTH = 140;
const JOB_ACTIONS_MENU_ESTIMATED_HEIGHT = 200;

function JobActionsMenuPortal({
  job,
  anchor,
  onClose,
  onTransition,
}: {
  job: JobListRow;
  anchor: HTMLElement;
  onClose: () => void;
  onTransition: (jobId: string, action: "publish" | "unpublish" | "close" | "archive") => void;
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
      <Link
        href={`/admin_recruiter/jobs/${job.id}/edit`}
        role="menuitem"
        className="block px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
        onClick={onClose}
      >
        {job.status === "archived" || job.status === "closed" ? "View" : "Edit"}
      </Link>
      {job.status === "draft" ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onTransition(job.id, "publish");
              onClose();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
          >
            Publish
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
      {job.status === "archived" ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onTransition(job.id, "unpublish");
            onClose();
          }}
          className="block w-full px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC]"
        >
          Unarchive
        </button>
      ) : (
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
      )}
    </div>,
    document.body
  );
}

export default function AdminRecruiterJobsPage() {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding);

  const [jobs, setJobs] = useState<JobListRow[]>([]);
  const [jobTab, setJobTab] = useState<JobTab>("all");
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
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
  const [sortField, setSortField] = useState<JobSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleToggleSort = useCallback((field: JobSortField) => {
    setSortField((current) => {
      if (current === field) {
        setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDirection("asc");
      return field;
    });
    setPage(1);
  }, []);

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

  async function transition(jobId: string, action: "publish" | "unpublish" | "close" | "archive") {
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

  const sortedJobs = useMemo(() => {
    if (!sortField) return filteredJobs;

    const next = [...filteredJobs];
    next.sort((a, b) => {
      const left =
        sortField === "jobTitle"
          ? (a.public_title || "").trim()
          : jobStatusSortLabel(a.status);
      const right =
        sortField === "jobTitle"
          ? (b.public_title || "").trim()
          : jobStatusSortLabel(b.status);
      const cmp = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return next;
  }, [filteredJobs, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sortedJobs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, sortedJobs.length);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const locationOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      const loc = jobLocation(job);
      if (loc && loc !== "—") values.add(loc);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const listColumns = listColumnOrder.length ? listColumnOrder : DEFAULT_JOB_COLUMNS;

  const hasActiveFilters = Boolean(
    jobIdFilter || statusFilter || titleFilter || locationFilter || assigneeFilter || postedByFilter
  );

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
    <div className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8" style={brandStyle}>
      <div className="mb-4">
        <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
          Jobs
        </h1>
        <p className={CANDIDATES_PAGE_SUBTITLE_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
          Manage jobs posting in one place
        </p>
      </div>

      <nav className="mb-4 w-full min-w-0 overflow-x-auto py-3 sm:py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" aria-label="Jobs navigation">
        <div className="flex w-max flex-nowrap items-start justify-start gap-4 sm:gap-5">
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
                  <span className="inline-flex aspect-square h-4 w-4 flex-col items-center justify-center gap-2 rounded-sm bg-[#CFCAC2] p-0.5 text-[10px] font-medium leading-none text-[#2B3D51]">
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
        {/* Mobile / tablet toolbar */}
        <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 xl:hidden">
          <div className="flex w-full items-center gap-2">
            <JobsFiltersToggleButton
              active={showFilterRows}
              hasActiveFilters={hasActiveFilters}
              onClick={() => setShowFilterRows((value) => !value)}
              className="shrink-0"
            />
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <MobileIconButton onClick={() => setEditColumnsOpen(true)} label="Columns">
                <Columns2 className="h-4 w-4" />
              </MobileIconButton>
              <Link
                href="/admin_recruiter/jobs/new"
                className={`${JOBS_POST_JOB_BUTTON_CLASS} inline-flex h-9 items-center gap-1.5 px-2.5 sm:h-8 sm:px-3`}
              >
                <Plus
                  className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                  style={{ color: branding.secondaryHex }}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="hidden min-[480px]:inline">Post a job</span>
                <span className="min-[480px]:hidden">Post</span>
              </Link>
            </div>
          </div>
          {showFilterRows ? (
            <JobsFilterFields
              variant="grid"
              jobIdFilter={jobIdFilter}
              onJobIdFilterChange={setJobIdFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              titleFilter={titleFilter}
              onTitleFilterChange={setTitleFilter}
              locationFilter={locationFilter}
              onLocationFilterChange={setLocationFilter}
              assigneeFilter={assigneeFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              postedByFilter={postedByFilter}
              onPostedByFilterChange={setPostedByFilter}
              locationOptions={locationOptions}
            />
          ) : null}
        </div>

        {/* Desktop toolbar */}
        <div className="hidden w-full flex-col xl:flex">
          <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-t-[12px] bg-white px-[14px] py-3">
            <div className="flex shrink-0 items-center gap-2">
              <JobsFiltersToggleButton
                active={showFilterRows}
                hasActiveFilters={hasActiveFilters}
                onClick={() => setShowFilterRows((value) => !value)}
                className="[&_span]:inline"
              />
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
              <JobsFilterFields
                variant="inline"
                jobIdFilter={jobIdFilter}
                onJobIdFilterChange={setJobIdFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                titleFilter={titleFilter}
                onTitleFilterChange={setTitleFilter}
                locationFilter={locationFilter}
                onLocationFilterChange={setLocationFilter}
                assigneeFilter={assigneeFilter}
                onAssigneeFilterChange={setAssigneeFilter}
                postedByFilter={postedByFilter}
                onPostedByFilterChange={setPostedByFilter}
                locationOptions={locationOptions}
                resultsCount={filteredJobs.length}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mx-[14px] mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm xl:min-w-full">
            <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium uppercase tracking-wide text-[#64748B]">
              <tr>
                {listColumns.map((colId) => (
                  <th
                    key={colId}
                    className={`border-r border-[#E5E7EB] px-[14px] py-3 font-medium normal-case tracking-normal last:border-r-0 ${jobListColumnClassName(colId)}`}
                    aria-sort={
                      isSortableJobColumn(colId) && sortField === colId
                        ? sortDirection === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {isSortableJobColumn(colId) ? (
                      <JobTableSortHeader
                        colId={colId}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onToggleSort={handleToggleSort}
                      />
                    ) : (
                      jobColumnLabel(colId)
                    )}
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
                        className={`border-r border-[#E5E7EB] px-[14px] py-4 align-middle last:border-r-0 ${jobListColumnClassName(colId)}`}
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

        <div className="flex flex-col gap-3 rounded-b-[12px] border-t border-[#E5E7EB] bg-white px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-sm text-[#64748B]">
            Showing {pageStart}-{pageEnd} of {filteredJobs.length} results
          </p>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-wrap sm:justify-end">
            <label className="flex shrink-0 items-center gap-2 text-sm text-[#64748B]">
              Show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`h-9 px-2 text-sm text-[#334155] xl:h-8 ${JOBS_FORM_SURFACE_CLASS}`}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
                className={`inline-flex h-9 items-center gap-1 px-2.5 text-sm text-[#334155] disabled:cursor-not-allowed disabled:opacity-50 xl:h-8 ${JOBS_FORM_SURFACE_CLASS}`}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden min-[480px]:inline">Previous</span>
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((pageNumber) => {
                const active = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex h-9 min-w-9 items-center justify-center px-2 text-sm xl:h-8 xl:min-w-8 ${
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
                className={`inline-flex h-9 items-center gap-1 px-2.5 text-sm text-[#334155] disabled:cursor-not-allowed disabled:opacity-50 xl:h-8 ${JOBS_FORM_SURFACE_CLASS}`}
              >
                <span className="hidden min-[480px]:inline">Next</span>
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
