"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { ListPaginationControls } from "@/app/admin_recruiter/components/ListPaginationControls";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
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

type ApplicationStatus = "in_progress" | "submitted" | "withdrawn" | "rejected" | "hired";

type ApplicationTab =
  | "all"
  | "new"
  | "reviewing"
  | "interviewing"
  | "rejected"
  | "hired"
  | "shortlisted"
  | "undecided";

type ApplicationRow = {
  id: string;
  status: ApplicationStatus | string;
  created_at: string;
  submitted_at: string | null;
  updated_at?: string | null;
  job_requisition_id: string;
  workflow_id: string;
  applicant_workflow_instance_id: string;
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

const APPLICATION_TABS: Array<{ id: ApplicationTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "reviewing", label: "Reviewing" },
  { id: "interviewing", label: "Interviewing" },
  { id: "rejected", label: "Rejected" },
  { id: "hired", label: "Hired" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "undecided", label: "Undecided" },
];

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

const MATCHES_PLACEHOLDER =
  "We didn't find matching qualifications. Review the candidate's profile to see their skills and experience.";

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
  switch (status) {
    case "submitted":
      return "new";
    case "in_progress":
      return "reviewing";
    case "rejected":
      return "rejected";
    case "hired":
      return "hired";
    case "withdrawn":
      return "undecided";
    default:
      return "reviewing";
  }
}

function matchesTab(row: ApplicationRow, tab: ApplicationTab): boolean {
  if (tab === "all") return true;
  if (tab === "interviewing" || tab === "shortlisted") return false;
  return statusTabFor(row.status) === tab;
}

function statusLabel(status: string): string {
  switch (status) {
    case "submitted":
      return "New";
    case "in_progress":
      return "Reviewing";
    case "rejected":
      return "Rejected";
    case "hired":
      return "Hired";
    case "withdrawn":
      return "Undecided";
    default:
      return status.replace(/_/g, " ");
  }
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
  if (row.status === "submitted") return `New Applicant • ${relative}`;
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

  useEffect(() => {
    setListColumnOrder(loadApplicationColumnOrder());
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setLocationFilter("");
    setPage(1);
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
      } catch {
        if (!cancelled) setJob(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, sortBy, locationFilter, pageSize, jobId]);

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
    next = [...next].sort((a, b) => {
      const aTime = new Date(a.submitted_at || a.created_at).getTime();
      const bTime = new Date(b.submitted_at || b.created_at).getTime();
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });
    return next;
  }, [rows, activeTab, locationFilter, sortBy]);

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

  function renderCell(colId: ApplicationColumnId, row: ApplicationRow) {
    switch (colId) {
      case "candidates": {
        const name = applicantName(row);
        const email = applicantEmail(row);
        return (
          <div className="flex min-w-0 items-center gap-3">
            <CandidateListAvatar name={name || "NA"} />
            <div className="min-w-0">
              <p
                className="truncate text-sm font-medium leading-5"
                style={{ color: branding.secondaryHex || "#012352" }}
              >
                {name}
              </p>
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
      case "matches":
        return <p className="text-sm leading-5 text-[#64748B]">{MATCHES_PLACEHOLDER}</p>;
      case "activity":
        return <p className="text-sm leading-5 text-[#475569]">{formatActivity(row)}</p>;
      case "interest":
        return (
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-1.5 py-1">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#16A34A] transition hover:bg-white"
              aria-label="Accept candidate"
              title="Accept"
            >
              <Check className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white"
              aria-label="Mark as maybe"
              title="Maybe"
            >
              <HelpCircle className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#DC2626] transition hover:bg-white"
              aria-label="Reject candidate"
              title="Reject"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white"
              aria-label="More actions"
              title="More"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        );
      case "status":
        return <span className="text-sm capitalize text-[#475569]">{statusLabel(row.status)}</span>;
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
      <div className="mb-9 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={CANDIDATES_PAGE_TITLE_CLASS} style={CANDIDATES_PAGE_TITLE_STYLE}>
            Candidates
          </h1>

          <div className="mt-4 flex min-w-0 flex-col gap-1">
            <div className="relative min-w-0" ref={jobMenuRef}>
              <button
                type="button"
                onClick={() => setJobMenuOpen((open) => !open)}
                className="inline-flex min-h-7 max-w-full items-center gap-1.5 text-left text-black transition hover:opacity-80"
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

              {jobMenuOpen ? (
                <div
                  className="absolute left-0 z-40 mt-2 flex w-[min(100vw-2rem,680px)] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
                  role="listbox"
                  aria-label="Jobs"
                >
                  <div className="space-y-3 border-b border-[#E5E7EB] p-4">
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

                    <div className="flex flex-nowrap items-center gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <select
                        value={jobStatusFilter}
                        onChange={(e) => setJobStatusFilter(e.target.value)}
                        className={`${FILTER_SELECT_CLASS} shrink-0`}
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
                        className={`${FILTER_SELECT_CLASS} shrink-0`}
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

                      <div className="ml-auto flex shrink-0 items-center gap-2">
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
                    </div>

                    <p className="inline-flex items-center gap-1.5 text-sm text-[#64748B]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/jobs-count-icon.svg"
                        alt=""
                        width={14}
                        height={14}
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden
                      />
                      <span>
                        {filteredJobOptions.length} of {jobOptions.length} jobs
                      </span>
                    </p>
                  </div>

                  <div className="border-b border-[#E5E7EB] px-4 py-3">
                    <p className="text-sm font-semibold leading-5 text-[#1E293B]">
                      Candidates for all open and paused jobs
                    </p>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
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
                            className="flex w-full items-center gap-3 border-b border-[#E5E7EB] px-4 py-3.5 text-left transition last:border-b-0 hover:bg-[#F8FAFC]"
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

        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] transition hover:bg-zinc-50"
          aria-label="Search candidates"
          title="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>

      <nav
        className="mb-4 w-full min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Candidates status"
      >
        <div className="flex w-max flex-nowrap items-stretch justify-start gap-5">
          {APPLICATION_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex shrink-0 flex-col items-stretch px-2 pb-2.5 pt-0 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                    active
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="flex items-center gap-2">
                    <span>{tab.label}</span>
                    <span className="inline-flex aspect-square h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-[#CFCAC2] p-0.5 text-[10px] font-medium leading-none text-[#2B3D51]">
                      {tabCounts[tab.id]}
                    </span>
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
            <button
              type="button"
              onClick={() => setShowFilterRows((value) => !value)}
              className={`inline-flex h-10 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition sm:h-8 sm:text-sm ${
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
              className="inline-flex h-10 items-center gap-1 rounded-md border border-[#dce6e3] bg-white px-2.5 text-xs font-medium text-[#334155] transition hover:bg-zinc-50 sm:h-8 sm:text-sm"
            >
              <ColumnsIcon />
              Columns
            </button>
            <Link
              href={
                jobId
                  ? `/admin_recruiter/applications/add-candidate?jobId=${encodeURIComponent(jobId)}`
                  : "/admin_recruiter/applications/add-candidate"
              }
              className={`${ADD_CANDIDATE_BUTTON_CLASS} ml-auto`}
            >
              <Plus
                className="h-4 w-4 shrink-0"
                style={{ color: branding.secondaryHex }}
                strokeWidth={2}
                aria-hidden
              />
              Add candidate
            </Link>
          </div>
          {showFilterRows ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-[#64748B]">Sort by:</span>
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
                className={FILTER_SELECT_CLASS}
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
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1]"
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
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="h-4 w-4 cursor-pointer rounded border-[#CBD5E1]"
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
            <label className="flex shrink-0 items-center gap-2 text-sm text-[#64748B]">
              Show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={`box-border h-8 px-2 text-sm text-[#334155] ${FORM_SURFACE_CLASS}`}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

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
    </div>
  );
}
