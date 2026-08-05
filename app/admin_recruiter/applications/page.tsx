"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  HelpCircle,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { BulkDeleteConfirmModal } from "@/app/admin_recruiter/components/BulkDeleteConfirmModal";
import { BulkDeleteToolbarButton } from "@/app/admin_recruiter/components/BulkDeleteToolbarButton";
import { ListPaginationControls, ListPaginationShowLabel } from "@/app/admin_recruiter/components/ListPaginationControls";
import { ListTableCheckbox } from "@/app/admin_recruiter/components/ListTableCheckbox";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  APPLICATION_STATUS_OPTIONS,
  APPLICATION_STATUS_TABS,
  applicationStatusBadgeClassName,
  applicationStatusLabel,
  matchesApplicationStatusTab,
  normalizeApplicationStatus,
  type ApplicationPipelineStatus,
  type ApplicationStatusTab,
} from "@/lib/jobs/application-status";
import toast from "react-hot-toast";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  APPLICATION_COLUMN_OPTIONS,
  DEFAULT_APPLICATION_COLUMNS,
  applicationColumnLabel,
  applicationListColumnClassName,
  loadApplicationColumnOrder,
  saveApplicationColumnOrder,
  type ApplicationColumnId,
} from "./application-columns";
import { JobPublicViewLink } from "@/app/admin_recruiter/jobs/JobPublicViewLink";

type ApplicationStatus = string;

type ApplicationTab = ApplicationStatusTab;

type ApplicationRow = {
  id: string;
  status: ApplicationStatus | string;
  created_at: string;
  submitted_at: string | null;
  updated_at?: string | null;
  job_requisition_id: string;
  workflow_id: string;
  applicant_workflow_instance_id: string;
  worker_id?: string | null;
  job_requisitions: Record<string, unknown> | Record<string, unknown>[] | null;
  onboarding_flows: Record<string, unknown> | Record<string, unknown>[] | null;
  applicant_profiles: Record<string, unknown> | Record<string, unknown>[] | null;
};

type JobHeader = {
  id: string;
  public_title: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
};

type JobOption = {
  id: string;
  public_title: string | null;
  location: string | null;
  facility: string | null;
  facility_name: string | null;
  status?: string;
  internal_requisition_number?: string | null;
  created_at?: string | null;
};

const APPLICATION_TABS = APPLICATION_STATUS_TABS;

const PAGE_SIZE_OPTIONS = [10, 20, 50];

/** Figma: Text/text-link — fixed email color under applicant name */
const TEXT_LINK_COLOR = "#64748B";

const FORM_SURFACE_CLASS = "rounded-lg border border-[#CBD5E1] bg-white";
const TOOLBAR_BUTTON_CLASS = `${FORM_SURFACE_CLASS} inline-flex h-8 items-center gap-1.5 px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50`;
const ADD_CANDIDATE_BUTTON_CLASS =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-normal leading-5 text-[#525252] transition hover:bg-zinc-50";
const FILTER_SELECT_CLASS = `${FORM_SURFACE_CLASS} h-8 cursor-pointer appearance-none bg-[length:12px_12px] bg-[right_10px_center] bg-no-repeat px-2.5 pr-8 text-sm font-normal leading-6 text-[#334155] hover:bg-zinc-50 focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0`;
const FILTER_SELECT_CHEVRON = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  )}")`,
} as const;

// const MATCHES_PLACEHOLDER =
//   "We didn't find matching qualifications. Review the candidate's profile to see their skills and experience.";

const INTEREST_STATUS_MENU_WIDTH = 160;
const INTEREST_STATUS_MENU_ESTIMATED_HEIGHT = 280;

function InterestStatusMenuPortal({
  options,
  anchor,
  busy,
  onClose,
  onSelect,
}: {
  options: Array<{ id: ApplicationPipelineStatus; label: string }>;
  anchor: HTMLElement;
  busy: boolean;
  onClose: () => void;
  onSelect: (status: ApplicationPipelineStatus) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + INTEREST_STATUS_MENU_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - INTEREST_STATUS_MENU_ESTIMATED_HEIGHT - 4);
    }
    setStyle({
      position: "fixed",
      top,
      left: Math.max(8, rect.right - INTEREST_STATUS_MENU_WIDTH),
      width: INTEREST_STATUS_MENU_WIDTH,
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
      className="z-[200] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
    >
      {options.length === 0 ? (
        <p className="px-3 py-2 text-sm text-[#94A3B8]">No other statuses</p>
      ) : (
        options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              onSelect(option.id);
              onClose();
            }}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            {option.label}
          </button>
        ))
      )}
    </div>,
    document.body
  );
}

function one(value: Record<string, unknown> | Record<string, unknown>[] | null) {
  return Array.isArray(value) ? value[0] ?? {} : value ?? {};
}

function FiltersIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M6.66667 12H9.33333V10.6667H6.66667V12ZM2 4V5.33333H14V4H2ZM4 8.66667H12V7.33333H4V8.66667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ColumnsIcon({ className = "h-4 w-4 shrink-0" }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M2.66667 7C2.11334 7 1.66667 7.44667 1.66667 8C1.66667 8.55333 2.11334 9 2.66667 9C3.22 9 3.66667 8.55333 3.66667 8C3.66667 7.44667 3.22 7 2.66667 7ZM2.66667 3C2.11334 3 1.66667 3.44667 1.66667 4C1.66667 4.55333 2.11334 5 2.66667 5C3.22 5 3.66667 4.55333 3.66667 4C3.66667 3.44667 3.22 3 2.66667 3ZM2.66667 11C2.11334 11 1.66667 11.4533 1.66667 12C1.66667 12.5467 2.12001 13 2.66667 13C3.21334 13 3.66667 12.5467 3.66667 12C3.66667 11.4533 3.22 11 2.66667 11ZM4.66667 12.6667H14V11.3333H4.66667V12.6667ZM4.66667 8.66667H14V7.33333H4.66667V8.66667ZM4.66667 3.33333V4.66667H14V3.33333H4.66667Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatJobLocation(job: JobHeader | null, fallbackJob?: Record<string, unknown>): string {
  if (job) {
    return (
      job.location?.trim() ||
      job.facility_name?.trim() ||
      job.facility?.trim() ||
      "—"
    );
  }
  if (!fallbackJob) return "—";
  return (
    String(fallbackJob.location ?? "").trim() ||
    String(fallbackJob.facility_name ?? "").trim() ||
    String(fallbackJob.facility ?? "").trim() ||
    "—"
  );
}

function jobReference(option: JobOption): string {
  return option.internal_requisition_number?.trim() || option.id.slice(0, 8).toUpperCase();
}

function statusTabFor(status: string): ApplicationTab {
  return normalizeApplicationStatus(status);
}

function matchesTab(row: ApplicationRow, tab: ApplicationTab): boolean {
  return matchesApplicationStatusTab(row.status, tab);
}

function statusLabel(status: string): string {
  return applicationStatusLabel(status);
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Applied yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatActivity(row: ApplicationRow): string {
  const when = row.updated_at || row.submitted_at || row.created_at;
  const relative = formatRelativeTime(when);
  if (row.status === "submitted" || row.status === "new") return `New Applicant • ${relative}`;
  return `${relative} • ${new Date(when).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

function applicantName(row: ApplicationRow): string {
  const applicant = one(row.applicant_profiles);
  return (
    [applicant.first_name, applicant.last_name].filter(Boolean).join(" ") ||
    String(applicant.email ?? "Applicant")
  );
}

function applicantEmail(row: ApplicationRow): string {
  return String(one(row.applicant_profiles).email ?? "");
}

function workflowName(row: ApplicationRow): string {
  return String(one(row.onboarding_flows).name ?? row.workflow_id);
}

export default function JobApplicationsPage() {
  const branding = useTenantBranding();
  const brandStyle = brandingToCssVars(branding) as CSSProperties;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobMenuRef = useRef<HTMLDivElement>(null);

  const jobId = searchParams.get("jobId")?.trim() ?? "";
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [job, setJob] = useState<JobHeader | null>(null);
  const [publicJobPath, setPublicJobPath] = useState<string | null>(null);
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);
  const [jobMenuOpen, setJobMenuOpen] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("");
  const [jobLocationFilter, setJobLocationFilter] = useState("");
  const [jobSortBy, setJobSortBy] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(Boolean(jobId));
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ApplicationTab>(() => {
    const initialTab = searchParams.get("tab")?.trim();
    if (
      initialTab === "all" ||
      initialTab === "new" ||
      initialTab === "reviewing" ||
      initialTab === "interviewing" ||
      initialTab === "rejected" ||
      initialTab === "hired" ||
      initialTab === "shortlisted" ||
      initialTab === "undecided"
    ) {
      return initialTab;
    }
    return "all";
  });
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [listColumnOrder, setListColumnOrder] = useState<ApplicationColumnId[]>([
    ...DEFAULT_APPLICATION_COLUMNS,
  ]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [locationFilter, setLocationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [candidateSearchOpen, setCandidateSearchOpen] = useState(false);
  const [candidateSearchDraft, setCandidateSearchDraft] = useState("");
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [interestMenu, setInterestMenu] = useState<{
    rowId: string;
    anchor: HTMLElement;
  } | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const candidateSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setListColumnOrder(loadApplicationColumnOrder());
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setLocationFilter("");
    setPage(1);
    setCandidateSearchOpen(false);
    setCandidateSearchDraft("");
    setCandidateSearchQuery("");
    setInterestMenu(null);
    setStatusBusyId(null);
    if (!jobId) {
      setJob(null);
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }
    // Drop previous job’s rows immediately so they never flash under a new job title.
    setRows([]);
    setLoading(true);
    setJob((current) => (current?.id === jobId ? current : null));
  }, [jobId]);

  useEffect(() => {
    const tabParam = searchParams.get("tab")?.trim();
    if (
      tabParam === "all" ||
      tabParam === "new" ||
      tabParam === "reviewing" ||
      tabParam === "interviewing" ||
      tabParam === "rejected" ||
      tabParam === "hired" ||
      tabParam === "shortlisted" ||
      tabParam === "undecided"
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!jobMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!jobMenuRef.current?.contains(event.target as Node)) {
        setJobMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setJobMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [jobMenuOpen]);

  const loadJobOptions = useCallback(async () => {
    setJobsLoading(true);
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
      setJobOptions((payload.jobs ?? []) as JobOption[]);
    } catch {
      setJobOptions([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobOptions();
  }, [loadJobOptions]);

  const selectJob = useCallback(
    (nextJob: JobOption) => {
      setJob({
        id: nextJob.id,
        public_title: nextJob.public_title ?? null,
        location: nextJob.location ?? null,
        facility: nextJob.facility ?? null,
        facility_name: nextJob.facility_name ?? null,
      });
      setRows([]);
      setSelectedIds(new Set());
      setActiveTab("all");
      setLocationFilter("");
      setJobMenuOpen(false);
      setLoading(true);

      const params = new URLSearchParams(searchParams.toString());
      params.set("jobId", nextJob.id);
      params.delete("tab");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const clearJobDropdownFilters = useCallback(() => {
    setJobSearch("");
    setJobStatusFilter("");
    setJobLocationFilter("");
    setJobSortBy("newest");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!jobId) {
        setRows([]);
        setLoading(false);
        setError("");
        return;
      }
      const requestJobId = jobId;
      const params = new URLSearchParams({ jobId: requestJobId });
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/job-applications?${params}`, { cache: "no-store" });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load applications");
        const applications = (payload.applications ?? []) as ApplicationRow[];
        setRows(applications.filter((row) => row.job_requisition_id === requestJobId));
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load applications");
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!jobId) {
        setJob(null);
        setPublicJobPath(null);
        return;
      }
      try {
        const response = await fetch(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load job");
        const data = payload.job ?? null;
        setJob(
          data
            ? {
                id: data.id,
                public_title: data.public_title ?? null,
                location: data.location ?? null,
                facility: data.facility ?? null,
                facility_name: data.facility_name ?? null,
              }
            : null
        );
        setPublicJobPath(
          typeof payload.publicJobPath === "string" ? payload.publicJobPath : null
        );
      } catch {
        if (!cancelled) {
          setJob(null);
          setPublicJobPath(null);
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, sortBy, locationFilter, pageSize, jobId, candidateSearchQuery]);

  useEffect(() => {
    if (!candidateSearchOpen) return;
    candidateSearchInputRef.current?.focus();
  }, [candidateSearchOpen]);

  const closeCandidateSearch = useCallback(() => {
    setCandidateSearchOpen(false);
    setCandidateSearchDraft("");
    setCandidateSearchQuery("");
  }, []);

  const applyCandidateSearch = useCallback(() => {
    setCandidateSearchQuery(candidateSearchDraft.trim());
  }, [candidateSearchDraft]);

  const selectedJobOption = useMemo(
    () => jobOptions.find((option) => option.id === jobId) ?? null,
    [jobOptions, jobId]
  );

  const jobDropdownLocations = useMemo(() => {
    const set = new Set<string>();
    for (const option of jobOptions) {
      const loc = formatJobLocation(option);
      if (loc && loc !== "—") set.add(loc);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobOptions]);

  const filteredJobOptions = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    let next = jobOptions.filter((option) => {
      if (jobStatusFilter && option.status !== jobStatusFilter) return false;
      if (jobLocationFilter) {
        const loc = formatJobLocation(option);
        if (loc !== jobLocationFilter) return false;
      }
      if (query) {
        const title = (option.public_title || "").toLowerCase();
        const ref = jobReference(option).toLowerCase();
        if (!title.includes(query) && !ref.includes(query)) return false;
      }
      return true;
    });
    next = [...next].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return jobSortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [jobOptions, jobSearch, jobStatusFilter, jobLocationFilter, jobSortBy]);

  const jobTitle =
    job?.public_title?.trim() ||
    selectedJobOption?.public_title?.trim() ||
    (jobId ? "Job" : "Select a job");
  const jobLocation = formatJobLocation(job ?? selectedJobOption);

  const tabCounts = useMemo(() => {
    const counts = Object.fromEntries(APPLICATION_TABS.map((tab) => [tab.id, 0])) as Record<
      ApplicationTab,
      number
    >;
    for (const row of rows) {
      counts.all += 1;
      const tab = statusTabFor(row.status);
      counts[tab] += 1;
    }
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => matchesTab(row, activeTab));
    if (locationFilter) {
      next = next.filter((row) => {
        const loc = formatJobLocation(null, one(row.job_requisitions));
        return loc.toLowerCase().includes(locationFilter.toLowerCase());
      });
    }
    const query = candidateSearchQuery.trim().toLowerCase();
    if (query) {
      next = next.filter((row) => {
        const name = applicantName(row).toLowerCase();
        const email = applicantEmail(row).toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }
    next = [...next].sort((a, b) => {
      const aTime = new Date(a.submitted_at || a.created_at).getTime();
      const bTime = new Date(b.submitted_at || b.created_at).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [rows, activeTab, locationFilter, sortBy, candidateSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const listColumns = listColumnOrder.length ? listColumnOrder : DEFAULT_APPLICATION_COLUMNS;
  const allVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every((row) => selectedIds.has(row.id));

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const loc = formatJobLocation(null, one(row.job_requisitions));
      if (loc && loc !== "—") set.add(loc);
    }
    if (jobLocation && jobLocation !== "—") set.add(jobLocation);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows, jobLocation]);

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const row of paginatedRows) next.delete(row.id);
      } else {
        for (const row of paginatedRows) next.add(row.id);
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmDeleteCandidates() {
    if (deleteBusy || selectedIds.size === 0) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/admin/job-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to delete candidates"
        );
      }
      const deletedIds = new Set<string>(
        Array.isArray(payload.deletedIds) ? payload.deletedIds.map(String) : []
      );
      setRows((current) => current.filter((row) => !deletedIds.has(row.id)));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      toast.success(
        `Deleted ${typeof payload.count === "number" ? payload.count : deletedIds.size} candidate${
          (payload.count ?? deletedIds.size) === 1 ? "" : "s"
        }`
      );
    } catch (deleteErr) {
      const message =
        deleteErr instanceof Error ? deleteErr.message : "Failed to delete candidates";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleteBusy(false);
    }
  }

  async function updateApplicationStatus(
    applicationId: string,
    nextStatus: ApplicationPipelineStatus
  ) {
    if (statusBusyId) return;
    setStatusBusyId(applicationId);
    setInterestMenu(null);
    try {
      const response = await fetch(`/api/admin/job-applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to update status"
        );
      }
      setRows((current) =>
        current.map((row) => (row.id === applicationId ? { ...row, status: nextStatus } : row))
      );
      toast.success(`Status updated to ${applicationStatusLabel(nextStatus)}`);
    } catch (updateError) {
      toast.error(
        updateError instanceof Error ? updateError.message : "Failed to update status"
      );
    } finally {
      setStatusBusyId(null);
    }
  }

  function renderCell(colId: ApplicationColumnId, row: ApplicationRow) {
    switch (colId) {
      case "candidates": {
        const name = applicantName(row);
        const email = applicantEmail(row);
        const detailHref =
          jobId
            ? `/admin_recruiter/applications/review?jobId=${encodeURIComponent(jobId)}&applicationId=${encodeURIComponent(row.id)}`
            : `/admin_recruiter/applications/review?applicationId=${encodeURIComponent(row.id)}`;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <CandidateListAvatar name={name || "NA"} />
            <div className="min-w-0">
              <Link
                href={detailHref}
                className="block truncate text-sm font-medium leading-5 hover:underline"
                style={{ color: branding.secondaryHex || "#012352" }}
              >
                {name}
              </Link>
              <p
                className="mt-0.5 truncate text-xs leading-4"
                style={{ color: TEXT_LINK_COLOR }}
              >
                {email || "—"}
              </p>
            </div>
          </div>
        );
      }
      // case "matches":
      //   return <p className="text-sm leading-5 text-[#64748B]">{MATCHES_PLACEHOLDER}</p>;
      case "activity":
        return <p className="text-sm leading-5 text-[#475569]">{formatActivity(row)}</p>;
      case "interest": {
        const currentStatus = normalizeApplicationStatus(row.status);
        const menuOpen = interestMenu?.rowId === row.id;
        const busy = statusBusyId === row.id;
        return (
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-1.5 py-1">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#16A34A] transition hover:bg-white"
              aria-label="Accept candidate"
              title="Accept"
              onClick={() => void updateApplicationStatus(row.id, "hired")}
              disabled={busy || currentStatus === "hired"}
            >
              <Check className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white"
              aria-label="Mark as maybe"
              title="Maybe"
              onClick={() => void updateApplicationStatus(row.id, "undecided")}
              disabled={busy || currentStatus === "undecided"}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#DC2626] transition hover:bg-white"
              aria-label="Reject candidate"
              title="Reject"
              onClick={() => void updateApplicationStatus(row.id, "rejected")}
              disabled={busy || currentStatus === "rejected"}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white ${
                menuOpen ? "bg-white ring-1 ring-[#CBD5E1]" : ""
              }`}
              aria-label="Update status"
              title="Update status"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={busy}
              onClick={(event) => {
                const anchor = event.currentTarget;
                setInterestMenu((current) =>
                  current?.rowId === row.id ? null : { rowId: row.id, anchor }
                );
              }}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        );
      }
      case "status":
        return (
          <span className={applicationStatusBadgeClassName(row.status)}>
            {statusLabel(row.status)}
          </span>
        );
      case "email":
        return <span className="text-sm text-[#475569]">{applicantEmail(row) || "—"}</span>;
      case "workflow":
        return <span className="text-sm text-[#475569]">{workflowName(row)}</span>;
      case "dateApplied":
        return (
          <span className="text-sm text-[#475569]">
            {new Date(row.submitted_at || row.created_at).toLocaleDateString()}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="box-border w-full min-w-0 max-w-full px-3 pb-8 pt-4 sm:px-5 sm:pt-5 lg:px-8"
      style={brandStyle}
    >
      <div className="mb-9 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
              Candidates
            </h1>
            {/* Mobile/tablet: search icon aligned with page title (avoids overlap with job title) */}
            {!candidateSearchOpen ? (
              <button
                type="button"
                onClick={() => setCandidateSearchOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] shadow-sm transition hover:bg-zinc-50 xl:hidden"
                aria-label="Open candidate search"
                title="Search"
              >
                <Search className="h-4 w-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-1">
            <div className="relative min-w-0" ref={jobMenuRef}>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setJobMenuOpen((open) => !open)}
                  className="inline-flex min-h-7 min-w-0 max-w-full items-center gap-1.5 text-left text-black transition hover:opacity-80"
                  aria-expanded={jobMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="Select job"
                >
                  <span className="text-base font-semibold leading-7 tracking-normal break-words">
                    {jobTitle}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#94A3B8] transition ${jobMenuOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <JobPublicViewLink href={publicJobPath} />
              </div>

              {jobMenuOpen ? (
                <div
                  className="absolute left-0 z-40 mt-2 flex w-[min(100%,calc(100vw-1.5rem))] max-w-[680px] max-h-[min(80vh,36rem)] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:w-[min(100vw-2rem,680px)]"
                  role="listbox"
                  aria-label="Jobs"
                >
                  <div className="space-y-3 border-b border-[#E5E7EB] p-3 sm:p-4">
                    <label className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/search-candidate-jobs.svg"
                        alt=""
                        width={20}
                        height={20}
                        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        placeholder="Search by job title or reference number"
                        className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-11 pr-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:cursor-pointer"
                        autoFocus
                      />
                    </label>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
                        <select
                          value={jobStatusFilter}
                          onChange={(e) => setJobStatusFilter(e.target.value)}
                          className={`${FILTER_SELECT_CLASS} min-w-0 flex-1 sm:flex-none sm:shrink-0`}
                          style={FILTER_SELECT_CHEVRON}
                          aria-label="Filter by status"
                        >
                          <option value="">Status</option>
                          <option value="published">Open</option>
                          <option value="draft">Draft</option>
                          <option value="closed">Closed</option>
                          <option value="archived">Archived</option>
                        </select>

                        <select
                          value={jobLocationFilter}
                          onChange={(e) => setJobLocationFilter(e.target.value)}
                          className={`${FILTER_SELECT_CLASS} min-w-0 flex-1 sm:flex-none sm:shrink-0`}
                          style={FILTER_SELECT_CHEVRON}
                          aria-label="Filter by location"
                        >
                          <option value="">Location</option>
                          {jobDropdownLocations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={clearJobDropdownFilters}
                          className="shrink-0 px-1 text-sm font-bold whitespace-nowrap text-black transition hover:opacity-80"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-start sm:gap-4">
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm whitespace-nowrap text-[#64748B]">Sort by</span>
                          <select
                            value={jobSortBy}
                            onChange={(e) => setJobSortBy(e.target.value as "newest" | "oldest")}
                            className={`${FILTER_SELECT_CLASS} shrink-0`}
                            style={FILTER_SELECT_CHEVRON}
                            aria-label="Sort jobs"
                          >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                          </select>
                        </div>
                        <p className="inline-flex min-w-0 items-center gap-1.5 text-sm text-[#64748B]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/jobs-count-icon.svg"
                            alt=""
                            width={14}
                            height={14}
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden
                          />
                          <span className="truncate">
                            {filteredJobOptions.length} of {jobOptions.length} jobs
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-[#E5E7EB] px-3 py-3 sm:px-4">
                    <p className="text-sm font-semibold leading-5 text-[#1E293B]">
                      Candidates for all open and paused jobs
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {jobsLoading ? (
                      <p className="px-4 py-6 text-sm text-[#64748B]">Loading jobs…</p>
                    ) : filteredJobOptions.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-[#64748B]">No jobs match these filters.</p>
                    ) : (
                      filteredJobOptions.map((option) => {
                        const title = option.public_title?.trim() || "Untitled job";
                        const location = formatJobLocation(option);
                        const selected = option.id === jobId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => selectJob(option)}
                            className="flex w-full items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 text-left transition last:border-b-0 hover:bg-[#F8FAFC] sm:px-4"
                          >
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                              {selected ? (
                                <Check
                                  className="h-5 w-5"
                                  style={{ color: branding.primaryHex }}
                                  strokeWidth={2.75}
                                  aria-label="Selected job"
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold leading-5 text-[#1E293B]">
                                {title}
                              </span>
                              <span className="mt-0.5 block text-xs leading-4 text-[#64748B]">
                                {location !== "—" ? location : jobReference(option)}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <p className="inline-flex min-w-0 items-center gap-1.5 text-sm leading-5 text-[#64748B]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
              <span className="break-words">{jobLocation}</span>
            </p>
          </div>
        </div>

        {/* Desktop search stays top-right; mobile/tablet open search uses full-width row below */}
        <div
          className={`flex shrink-0 items-center justify-end self-start ${
            candidateSearchOpen
              ? "order-last mt-1 w-full basis-full xl:order-none xl:mt-12 xl:w-auto xl:basis-auto"
              : "mt-0 hidden xl:mt-12 xl:flex"
          }`}
        >
          {candidateSearchOpen ? (
            <form
              className="flex w-full items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white p-1.5 xl:w-[380px]"
              onSubmit={(event) => {
                event.preventDefault();
                applyCandidateSearch();
              }}
            >
              <input
                ref={candidateSearchInputRef}
                type="search"
                value={candidateSearchDraft}
                onChange={(e) => setCandidateSearchDraft(e.target.value)}
                placeholder="Search candidates"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#334155] placeholder:text-[#94A3B8] focus:border-[color:var(--brand-primary)] focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:cursor-pointer [&::-webkit-search-decoration]:cursor-pointer"
                aria-label="Search candidates"
              />
              <button
                type="submit"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white px-3.5 text-sm font-semibold text-[#1E293B] transition hover:bg-zinc-50"
              >
                Search
              </button>
              <button
                type="button"
                onClick={closeCandidateSearch}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#334155] transition hover:bg-zinc-50"
                aria-label="Close search"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCandidateSearchOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#0F172A] shadow-sm transition hover:bg-zinc-50"
              aria-label="Open candidate search"
              title="Search"
            >
              <Search className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <nav
        className="mb-4 w-full min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Candidates status"
      >
        <div className="flex w-max flex-nowrap items-center justify-start gap-5">
          {APPLICATION_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex shrink-0 flex-col items-center px-2 pb-2.5 pt-0 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                    active
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{tab.label}</span>
                    <span className="admin-recruiter-tab-count rounded-sm">{tabCounts[tab.id]}</span>
                  </span>
                  <span
                    className={`absolute inset-x-0 bottom-0 block h-0.5 rounded-full ${
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
        <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 xl:hidden">
          <div className="flex w-full items-center gap-2">
            <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((value) => !value)}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition sm:h-8 ${
                  showFilterRows
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
                    : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
                }`}
                aria-label="Filters"
                title="Filters"
                aria-expanded={showFilterRows}
              >
                <FiltersIcon />
              </button>
              <button
                type="button"
                onClick={() => setEditColumnsOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dce6e3] bg-white text-[#334155] transition hover:bg-zinc-50 sm:h-8"
                aria-label="Columns"
                title="Columns"
              >
                <ColumnsIcon />
              </button>
              <BulkDeleteToolbarButton
                count={selectedIds.size}
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>
            <Link
              href={
                jobId
                  ? `/admin_recruiter/applications/add-candidate?jobId=${encodeURIComponent(jobId)}`
                  : "/admin_recruiter/applications/add-candidate"
              }
              className={`${ADD_CANDIDATE_BUTTON_CLASS} ml-auto h-9 whitespace-nowrap px-2.5 sm:h-8 sm:px-3`}
            >
              <Plus
                className="h-4 w-4 shrink-0"
                style={{ color: branding.secondaryHex }}
                strokeWidth={2}
                aria-hidden
              />
              <span className="hidden min-[480px]:inline">Add candidate</span>
              <span className="min-[480px]:hidden">Add</span>
            </Link>
          </div>
          {showFilterRows ? (
            <div className="grid grid-cols-1 gap-5 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 min-[450px]:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium leading-4 text-[#475569]">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                  className={`${FILTER_SELECT_CLASS} h-10 w-full min-w-0`}
                  style={FILTER_SELECT_CHEVRON}
                  aria-label="Sort by"
                >
                  <option value="newest">Apply date (Newest first)</option>
                  <option value="oldest">Apply date (Oldest first)</option>
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium leading-4 text-[#475569]">Location</span>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className={`${FILTER_SELECT_CLASS} h-10 w-full min-w-0 ${
                    locationFilter ? "text-[#334155]" : "text-[#94A3B8]"
                  }`}
                  style={FILTER_SELECT_CHEVRON}
                  aria-label="Location"
                >
                  <option value="">Location</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="hidden w-full flex-col xl:flex">
          <div className="flex w-full shrink-0 items-center justify-between gap-3 rounded-t-[12px] bg-white px-[14px] py-3">
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((value) => !value)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition ${
                  showFilterRows
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
                    : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
                }`}
              >
                <FiltersIcon />
                Filters
              </button>
              <button
                type="button"
                onClick={() => setEditColumnsOpen(true)}
                className={TOOLBAR_BUTTON_CLASS}
              >
                <ColumnsIcon />
                Columns
              </button>
              <BulkDeleteToolbarButton
                count={selectedIds.size}
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>

            <Link
              href={
                jobId
                  ? `/admin_recruiter/applications/add-candidate?jobId=${encodeURIComponent(jobId)}`
                  : "/admin_recruiter/applications/add-candidate"
              }
              className={ADD_CANDIDATE_BUTTON_CLASS}
            >
              <Plus
                className="h-5 w-5 shrink-0"
                style={{ color: branding.secondaryHex }}
                strokeWidth={2}
                aria-hidden
              />
              Add candidate
            </Link>
          </div>

          <div className="border-b border-[#E5E7EB]" aria-hidden />

          {showFilterRows ? (
            <div className="flex w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-[#E5E7EB] px-[14px] py-3">
              <span className="shrink-0 text-sm text-[#64748B]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                className={FILTER_SELECT_CLASS}
                style={FILTER_SELECT_CHEVRON}
              >
                <option value="newest">Apply date (Newest first)</option>
                <option value="oldest">Apply date (Oldest first)</option>
              </select>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className={`${FILTER_SELECT_CLASS} min-w-[120px]`}
                style={FILTER_SELECT_CHEVRON}
              >
                <option value="">Location</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
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
            <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
              <tr>
                <th className="w-12 border-r border-[#E5E7EB] px-[14px] py-3">
                  <ListTableCheckbox
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible candidates"
                  />
                </th>
                {listColumns.map((colId) => (
                  <th
                    key={colId}
                    className={`border-r border-[#E5E7EB] px-[14px] py-3 font-medium normal-case tracking-normal last:border-r-0 ${applicationListColumnClassName(colId)}`}
                  >
                    {applicationColumnLabel(colId)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td
                    colSpan={listColumns.length + 1}
                    className="px-[14px] py-12 text-center text-[#64748B]"
                  >
                    Loading candidates…
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr className="border-b border-[#E9EDF3]">
                  <td
                    colSpan={listColumns.length + 1}
                    className="px-[14px] py-12 text-center text-[#64748B]"
                  >
                    {jobId
                      ? "No candidates match these filters."
                      : "Select a job from the jobs list to view candidates."}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#E9EDF3] align-middle hover:bg-[#FAFBFC]"
                  >
                    <td className="border-r border-[#E5E7EB] px-[14px] py-2.5 align-middle">
                      <ListTableCheckbox
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Select ${applicantName(row)}`}
                      />
                    </td>
                    {listColumns.map((colId) => (
                      <td
                        key={colId}
                        className={`border-r border-[#E5E7EB] px-[14px] py-2.5 align-middle last:border-r-0 ${applicationListColumnClassName(colId)}`}
                      >
                        {renderCell(colId, row)}
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
            Showing {pageStart}-{pageEnd} of {filteredRows.length} results
          </p>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-wrap sm:justify-end">
            <ListPaginationShowLabel
              pageSize={pageSize}
              options={PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
            />

            <ListPaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              activeStyle={{ backgroundColor: branding.secondaryHex, borderColor: branding.secondaryHex }}
            />
          </div>
        </div>
      </div>

      <ColumnsEditorModal
        key={editColumnsOpen ? "application-cols-open" : "application-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={APPLICATION_COLUMN_OPTIONS}
        value={listColumnOrder}
        title="Edit Columns"
        description="Choose which columns appear in the candidates list and drag to reorder them."
        onSave={(order) => {
          setListColumnOrder(order);
          saveApplicationColumnOrder(order);
        }}
      />

      {interestMenu ? (
        <InterestStatusMenuPortal
          options={APPLICATION_STATUS_OPTIONS.filter((option) => {
            const menuRow = rows.find((row) => row.id === interestMenu.rowId);
            if (!menuRow) return true;
            return option.id !== normalizeApplicationStatus(menuRow.status);
          })}
          anchor={interestMenu.anchor}
          busy={statusBusyId === interestMenu.rowId}
          onClose={() => setInterestMenu(null)}
          onSelect={(status) => {
            void updateApplicationStatus(interestMenu.rowId, status);
          }}
        />
      ) : null}

      <BulkDeleteConfirmModal
        open={deleteConfirmOpen}
        entity="candidate"
        count={selectedIds.size}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDeleteCandidates()}
      />
    </div>
  );
}
