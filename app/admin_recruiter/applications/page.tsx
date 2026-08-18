"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  HelpCircle,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
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
import AddCallLogModal from "@/app/admin_recruiter/components/AddCallLogModal";
import CandidateCommunicationDialog from "@/app/admin_recruiter/components/CandidateCommunicationDialog";
import { ScheduleInterviewModal } from "@/app/admin_recruiter/calendar/components/ScheduleInterviewModal";
import {
  invitationSuccessMessage,
  type ScheduleInterviewPayload,
} from "@/lib/interviews/schedule-payload";
import SuccessModal from "@/app/components/SuccessModal";
import ErrorModal from "@/app/components/ErrorModal";
import { validateResumeUploadFile } from "@/lib/resume/validate-resume-upload";
import { CandidateAiFinalApprovalLink } from "@/app/admin_recruiter/candidates/CandidateAiFinalApprovalLink";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  CANDIDATES_PAGE_TITLE_CLASS,
  CANDIDATES_PAGE_TITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import {
  resolveApplicationApplicantEmail,
  resolveApplicationApplicantLocation,
  resolveApplicationApplicantName,
  resolveApplicationApplicantPhone,
  resolveApplicationWorkerId,
} from "@/lib/jobs/application-applicant-display";
import {
  applicationCurrentStageMeta,
  applicationStatusDotClassName,
  applicationStatusLabel,
  isArchivedApplicationStatus,
  normalizeApplicationStatus,
  type ApplicationPipelineStatus,
} from "@/lib/jobs/application-status";
import toast from "react-hot-toast";
import { brandingToCssVars } from "@/lib/tenant/tenant-branding";
import {
  APPLICATION_EDITABLE_COLUMNS,
  DEFAULT_APPLICATION_COLUMNS,
  applicationColumnLabel,
  applicationListColumnClassName,
  ensureActionsLast,
  loadApplicationColumnOrder,
  saveApplicationColumnOrder,
  type ApplicationColumnId,
} from "./application-columns";
import { CandidateAiAnalysisButton } from "./CandidateAiAnalysisButton";
import {
  ApplicationStatusChangeModal,
  ApplicationStatusHistoryDialog,
  type ApplicationStatusOption,
} from "./ApplicationStatusUi";
import { CandidateRowActionsMenu } from "./CandidateRowActionsMenu";
import { MatchScoreCell } from "./MatchAnalysisPanel";
import { ReplaceResumeConfirmModal } from "./ReplaceResumeConfirmModal";
import { matchCategoryRelevanceRank } from "@/lib/jobs/match-analysis/display";
import { JobPublicViewLink } from "@/app/admin_recruiter/jobs/JobPublicViewLink";
import AddCandidateModal from "./AddCandidateModal";
import JobPublishToggle from "@/app/admin_recruiter/jobs/JobPublishToggle";

type ApplicationStatus = string;

type ApplicationTab = "all" | string;

type ApplicationRow = {
  id: string;
  status: ApplicationStatus | string;
  status_id?: string | null;
  statusName?: string | null;
  statusNote?: string | null;
  created_at: string;
  submitted_at: string | null;
  updated_at?: string | null;
  job_requisition_id: string;
  workflow_id: string;
  applicant_workflow_instance_id: string;
  worker_id?: string | null;
  appliedJobCount?: number | null;
  workflow_phase?: string | null;
  ai_match_status?: string | null;
  ai_match_score?: number | null;
  ai_match_category?: string | null;
  ai_match_action?: string | null;
  ai_match_readiness?: string | null;
  ai_match_display_category?: string | null;
  application_statuses?:
    | { id?: string; name?: string; system_key?: string | null; color?: string | null }
    | { id?: string; name?: string; system_key?: string | null; color?: string | null }[]
    | null;
  job_requisitions: Record<string, unknown> | Record<string, unknown>[] | null;
  onboarding_flows: Record<string, unknown> | Record<string, unknown>[] | null;
  applicant_profiles: Record<string, unknown> | Record<string, unknown>[] | null;
  worker?: Record<string, unknown> | Record<string, unknown>[] | null;
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

const PAGE_SIZE_OPTIONS = [10, 20, 50];

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

const STATUS_DROPDOWN_WIDTH = 180;
const STATUS_DROPDOWN_ESTIMATED_HEIGHT = 280;

function StatusDropdownPortal({
  options,
  currentStatusId,
  anchor,
  busy,
  onClose,
  onSelect,
}: {
  options: ApplicationStatusOption[];
  currentStatusId: string | null;
  anchor: HTMLElement;
  busy: boolean;
  onClose: () => void;
  onSelect: (option: ApplicationStatusOption) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  const updatePosition = useCallback(() => {
    const rect = anchor.getBoundingClientRect();
    let top = rect.bottom + 4;
    if (top + STATUS_DROPDOWN_ESTIMATED_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - STATUS_DROPDOWN_ESTIMATED_HEIGHT - 4);
    }
    setStyle({
      position: "fixed",
      top,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - STATUS_DROPDOWN_WIDTH - 8)),
      width: STATUS_DROPDOWN_WIDTH,
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

  const selectable = options.filter((option) => option.id !== currentStatusId);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={style}
      className="z-[200] max-h-72 overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-lg"
    >
      {selectable.length === 0 ? (
        <p className="px-3 py-2 text-sm text-[#94A3B8]">No other statuses</p>
      ) : (
        selectable.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              onSelect(option);
              onClose();
            }}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"
          >
            {option.name}
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

function oneStatusJoin(
  value:
    | { id?: string; name?: string; system_key?: string | null; color?: string | null }
    | { id?: string; name?: string; system_key?: string | null; color?: string | null }[]
    | null
    | undefined
) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function rowStatusId(row: ApplicationRow): string | null {
  const joined = oneStatusJoin(row.application_statuses);
  return row.status_id?.trim() || joined?.id?.trim() || null;
}

function rowStatusName(row: ApplicationRow, options: ApplicationStatusOption[]): string {
  const joined = oneStatusJoin(row.application_statuses);
  return (
    row.statusName?.trim() ||
    joined?.name?.trim() ||
    options.find((option) => option.id === rowStatusId(row))?.name ||
    applicationStatusLabel(row.status)
  );
}

function rowStatusDotColor(row: ApplicationRow, options: ApplicationStatusOption[]): string | null {
  const joined = oneStatusJoin(row.application_statuses);
  const fromJoin = typeof joined?.color === "string" ? joined.color.trim() : "";
  if (fromJoin) return fromJoin;
  const fromOption = options.find((option) => option.id === rowStatusId(row))?.color?.trim();
  return fromOption || null;
}

function isRowArchived(row: ApplicationRow, options: ApplicationStatusOption[]): boolean {
  const joined = oneStatusJoin(row.application_statuses);
  if (joined?.system_key === "archived") return true;
  const option = options.find((item) => item.id === rowStatusId(row));
  if (option?.systemKey === "archived") return true;
  return isArchivedApplicationStatus(row.status);
}

function matchesTab(
  row: ApplicationRow,
  tab: ApplicationTab,
  options: ApplicationStatusOption[]
): boolean {
  const archived = isRowArchived(row, options);
  if (tab === "all") return !archived;

  const statusId = rowStatusId(row);
  if (statusId && statusId === tab) return true;

  const option = options.find((item) => item.id === tab);
  if (option?.systemKey === "archived") return archived;
  if (archived) return false;

  if (option?.systemKey) {
    return normalizeApplicationStatus(row.status) === option.systemKey;
  }
  // Legacy URL tab keys (new/reviewing/…)
  return normalizeApplicationStatus(row.status) === tab;
}

function formatTimeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.floor(Math.max(0, Date.now() - date.getTime()) / 86400000);
  if (days >= 7) {
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }
  return formatTimeAgo(iso);
}

function formatApplicationDate(iso: string | null | undefined): { relative: string; absolute: string } {
  if (!iso) return { relative: "—", absolute: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { relative: "—", absolute: "" };
  return {
    relative: formatTimeAgo(iso),
    absolute: date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
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

const ACTION_TOAST_DURATION_MS = 4000;

function statusChangeSuccessMessage(
  systemKey: string | null,
  statusName: string,
  candidateName: string
): string {
  switch (systemKey) {
    case "hired":
      return `${candidateName} marked as hired successfully`;
    case "rejected":
      return `${candidateName} marked as rejected`;
    case "undecided":
      return `${candidateName} marked as undecided`;
    case "shortlisted":
      return `${candidateName} shortlisted successfully`;
    case "interviewing":
      return `${candidateName} moved to interviewing`;
    case "reviewing":
      return `${candidateName} moved to reviewing`;
    case "new":
      return `${candidateName} moved to new`;
    default:
      return `${candidateName} status updated to ${statusName}`;
  }
}

function applicantName(row: ApplicationRow): string {
  return resolveApplicationApplicantName(row);
}

function applicantEmail(row: ApplicationRow): string {
  return resolveApplicationApplicantEmail(row);
}

function applicantLocation(row: ApplicationRow): string {
  return resolveApplicationApplicantLocation(row);
}

function applicantPhone(row: ApplicationRow): string {
  return resolveApplicationApplicantPhone(row);
}

function workflowName(row: ApplicationRow): string {
  return String(one(row.onboarding_flows).name ?? row.workflow_id);
}

function HighlightMultiJobApplicantsRow({
  on,
  onToggle,
  activeColor,
  className = "px-[14px] py-3",
}: {
  on: boolean;
  onToggle: () => void;
  activeColor?: string;
  className?: string;
}) {
  return (
    <div className={`flex w-full items-center justify-end gap-2 ${className}`}>
      <span className="text-[10px] font-normal leading-[15px] text-[#374151]">
        Highlight Multi-Job Applicants
      </span>
      <JobPublishToggle
        checked={on}
        onChange={onToggle}
        activeColor={activeColor}
        ariaLabel={
          on
            ? "Show all applicants"
            : "Show only applicants who applied to multiple jobs"
        }
      />
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ApplicationTab>(() => {
    return searchParams.get("tab")?.trim() || "all";
  });
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [listColumnOrder, setListColumnOrder] = useState<ApplicationColumnId[]>([
    ...DEFAULT_APPLICATION_COLUMNS,
  ]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "matchScore" | "matchScoreAsc">(
    "matchScore"
  );
  const [locationFilter, setLocationFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [candidateSearchOpen, setCandidateSearchOpen] = useState(false);
  const [candidateSearchDraft, setCandidateSearchDraft] = useState("");
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [highlightMultiJobApplicants, setHighlightMultiJobApplicants] = useState(false);
  const [rowActionsMenu, setRowActionsMenu] = useState<{
    rowId: string;
    anchor: HTMLElement;
  } | null>(null);
  const [statusMenu, setStatusMenu] = useState<{
    rowId: string;
    anchor: HTMLElement;
  } | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<ApplicationStatusOption[]>([]);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    applicationId: string;
    fromLabel: string;
    toOption: ApplicationStatusOption;
  } | null>(null);
  const [statusChangeNote, setStatusChangeNote] = useState("");
  const [historyDialog, setHistoryDialog] = useState<{
    applicationId: string;
    candidateName: string;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<
    Array<{
      id: string;
      fromStatus: { id: string | null; name: string | null };
      toStatus: { id: string | null; name: string };
      note: string | null;
      changedBy: { id: string | null; name: string | null };
      changedAt: string;
    }>
  >([]);
  const [matchAnalyzingId, setMatchAnalyzingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [actionTargetRowId, setActionTargetRowId] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewSubmitting, setInterviewSubmitting] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [resumeUploadApplicationId, setResumeUploadApplicationId] = useState<string | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [pendingResumeFile, setPendingResumeFile] = useState<File | null>(null);
  const [pendingResumeApplicationId, setPendingResumeApplicationId] = useState<string | null>(
    null
  );
  const [resumeSuccessOpen, setResumeSuccessOpen] = useState(false);
  const [resumeErrorOpen, setResumeErrorOpen] = useState(false);
  const [resumeErrorMessage, setResumeErrorMessage] = useState("");
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [applicationsRefreshNonce, setApplicationsRefreshNonce] = useState(0);
  const resumeInputRef = useRef<HTMLInputElement>(null);
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
    setRowActionsMenu(null);
    setStatusMenu(null);
    setStatusBusyId(null);
    setPendingStatusChange(null);
    setStatusChangeNote("");
    setHistoryDialog(null);
    setRows([]);
    setLoading(true);
    if (!jobId) {
      setJob(null);
      setError("");
      return;
    }
    setJob((current) => (current?.id === jobId ? current : null));
  }, [jobId]);

  useEffect(() => {
    const tabParam = searchParams.get("tab")?.trim() || "all";
    if (tabParam === "all") {
      setActiveTab("all");
      return;
    }
    const byId = statusOptions.find((option) => option.id === tabParam);
    if (byId) {
      setActiveTab(byId.id);
      return;
    }
    const byKey = statusOptions.find((option) => option.systemKey === tabParam);
    setActiveTab(byKey?.id ?? tabParam);
  }, [searchParams, statusOptions]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/application-statuses?activeOnly=1", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load statuses");
        setStatusOptions(
          ((payload.statuses ?? []) as Array<Record<string, unknown>>).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            systemKey: (row.systemKey as string | null) ?? null,
            color: (row.color as string | null) ?? null,
            sortOrder: Number(row.sortOrder ?? 0),
          }))
        );
      } catch {
        setStatusOptions([]);
      }
    })();
  }, []);

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
      setLocationFilter("");
      setJobMenuOpen(false);
      setLoading(true);

      const params = new URLSearchParams(searchParams.toString());
      params.set("jobId", nextJob.id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const selectAllJobs = useCallback(() => {
    setJob(null);
    setRows([]);
    setSelectedIds(new Set());
    setLocationFilter("");
    setJobMenuOpen(false);
    setLoading(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("jobId");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }, [pathname, router, searchParams]);

  const clearJobDropdownFilters = useCallback(() => {
    setJobSearch("");
    setJobStatusFilter("");
    setJobLocationFilter("");
    setJobSortBy("newest");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const requestJobId = jobId;
      const params = new URLSearchParams();
      if (requestJobId) params.set("jobId", requestJobId);
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/job-applications?${params}`, { cache: "no-store" });
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(payload.error || "Failed to load applications");
        const applications = (payload.applications ?? []) as ApplicationRow[];
        setRows(
          requestJobId
            ? applications.filter((row) => row.job_requisition_id === requestJobId)
            : applications
        );
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
  }, [jobId, applicationsRefreshNonce]);

  function openAddCandidateModal() {
    if (!jobId) {
      toast.error("Select a job before adding a candidate.");
      return;
    }
    setAddCandidateOpen(true);
  }

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
  }, [activeTab, sortBy, locationFilter, pageSize, jobId, candidateSearchQuery, highlightMultiJobApplicants]);

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
    (jobId ? "Job" : "All jobs");
  const jobLocation = formatJobLocation(job ?? selectedJobOption);

  const statusTabs = useMemo(() => {
    const pipeline = statusOptions.filter((option) => option.systemKey !== "archived");
    const archivedTab = statusOptions.find((option) => option.systemKey === "archived");
    return [
      { id: "all" as const, label: "All" },
      ...pipeline.map((s) => ({ id: s.id, label: s.name })),
      ...(archivedTab ? [{ id: archivedTab.id, label: archivedTab.name }] : []),
    ];
  }, [statusOptions]);

  const selectableStatusOptions = useMemo(
    () => statusOptions.filter((option) => option.systemKey !== "archived"),
    [statusOptions]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const option of statusOptions) counts[option.id] = 0;
    for (const row of rows) {
      const archived = isRowArchived(row, statusOptions);
      if (!archived) counts.all += 1;

      const statusId = rowStatusId(row);
      if (statusId && statusId in counts) {
        counts[statusId] += 1;
        continue;
      }
      const byKey = statusOptions.find(
        (option) =>
          option.systemKey &&
          option.systemKey ===
            (archived ? "archived" : normalizeApplicationStatus(row.status))
      );
      if (byKey) counts[byKey.id] += 1;
    }
    return counts;
  }, [rows, statusOptions]);

  const filteredRows = useMemo(() => {
    let next = rows.filter((row) => matchesTab(row, activeTab, statusOptions));
    if (locationFilter) {
      next = next.filter((row) => {
        const loc = applicantLocation(row);
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
    if (highlightMultiJobApplicants) {
      next = next.filter((row) => Number(row.appliedJobCount ?? 1) > 1);
    }
    next = [...next].sort((a, b) => {
      if (sortBy === "matchScore" || sortBy === "matchScoreAsc") {
        const aScore = a.ai_match_score == null ? -1 : Number(a.ai_match_score);
        const bScore = b.ai_match_score == null ? -1 : Number(b.ai_match_score);
        if (bScore !== aScore) {
          return sortBy === "matchScoreAsc" ? aScore - bScore : bScore - aScore;
        }
        // Tie-break: higher overall qualification/relevance first
        const aRelevance = matchCategoryRelevanceRank(a.ai_match_category);
        const bRelevance = matchCategoryRelevanceRank(b.ai_match_category);
        if (bRelevance !== aRelevance) return bRelevance - aRelevance;
      }
      const aTime = new Date(a.submitted_at || a.created_at).getTime();
      const bTime = new Date(b.submitted_at || b.created_at).getTime();
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return next;
  }, [rows, activeTab, locationFilter, sortBy, candidateSearchQuery, statusOptions, highlightMultiJobApplicants]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredRows.length);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const listColumns = ensureActionsLast(
    listColumnOrder.length ? listColumnOrder : DEFAULT_APPLICATION_COLUMNS
  );
  const allVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every((row) => selectedIds.has(row.id));

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const loc = applicantLocation(row);
      if (loc) set.add(loc);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

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
    const idsToDelete =
      pendingDeleteIds.length > 0 ? pendingDeleteIds : [...selectedIds];
    if (deleteBusy || idsToDelete.length === 0) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/admin/job-applications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
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
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of deletedIds) next.delete(id);
        return next;
      });
      setPendingDeleteIds([]);
      setDeleteConfirmOpen(false);
      const deletedCount =
        typeof payload.count === "number" ? payload.count : deletedIds.size;
      toast.success(
        `Deleted ${deletedCount} candidate${deletedCount === 1 ? "" : "s"}`,
        { duration: ACTION_TOAST_DURATION_MS }
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

  function actionRow(): ApplicationRow | null {
    if (!actionTargetRowId) return null;
    return rows.find((row) => row.id === actionTargetRowId) ?? null;
  }

  function beginDeleteCandidate(applicationId: string) {
    setPendingDeleteIds([applicationId]);
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  function beginUpdateResume(applicationId: string) {
    const row = rows.find((item) => item.id === applicationId);
    if (!row) return;
    const workerId = resolveApplicationWorkerId(row);
    const profile = Array.isArray(row.applicant_profiles)
      ? row.applicant_profiles[0]
      : row.applicant_profiles;
    const profileId =
      profile && typeof profile === "object" && typeof (profile as { id?: unknown }).id === "string"
        ? String((profile as { id: string }).id).trim()
        : "";
    if (!workerId && !profileId) {
      setResumeErrorMessage("Candidate profile is not linked yet. Cannot update resume.");
      setResumeErrorOpen(true);
      return;
    }
    setResumeUploadApplicationId(applicationId);
    // Defer click so React state is committed before the picker opens.
    window.requestAnimationFrame(() => {
      resumeInputRef.current?.click();
    });
  }

  async function handleResumeFileSelected(file: File | undefined) {
    const applicationId = resumeUploadApplicationId;
    setResumeUploadApplicationId(null);
    if (resumeInputRef.current) resumeInputRef.current.value = "";
    if (!file || !applicationId) return;

    const validationError = validateResumeUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (validationError) {
      setResumeErrorMessage(validationError);
      setResumeErrorOpen(true);
      return;
    }

    setPendingResumeApplicationId(applicationId);
    setPendingResumeFile(file);
  }

  async function confirmReplaceResumeFromList() {
    const applicationId = pendingResumeApplicationId;
    const file = pendingResumeFile;
    if (!file || !applicationId) return;

    setResumeUploading(true);
    try {
      const form = new FormData();
      form.set("resume", file);
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/resume`,
        { method: "POST", body: form }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to upload resume"
        );
      }

      setRows((current) =>
        current.map((row) =>
          row.id === applicationId
            ? {
                ...row,
                ai_match_status: "ANALYZING",
                ai_match_score: null,
                ai_match_category: null,
                ai_match_action: null,
                ai_match_readiness: null,
                ai_match_display_category: null,
              }
            : row
        )
      );
      setPendingResumeFile(null);
      setPendingResumeApplicationId(null);
      const candidateLabel = applicantName(
        rows.find((row) => row.id === applicationId) ?? ({ id: applicationId } as ApplicationRow)
      );
      toast.success(`${candidateLabel}: resume updated successfully`, {
        duration: ACTION_TOAST_DURATION_MS,
      });
      setResumeSuccessOpen(true);

      void (async () => {
        try {
          const matchResponse = await fetch(
            `/api/admin/job-applications/${encodeURIComponent(applicationId)}/match-analysis`,
            {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}),
            }
          );
          const matchPayload = await matchResponse.json().catch(() => ({}));
          if (!matchResponse.ok) return;
          setRows((current) =>
            current.map((row) =>
              row.id === applicationId
                ? {
                    ...row,
                    ai_match_status: matchPayload.status ?? "ANALYZED",
                    ai_match_score: matchPayload.score ?? null,
                    ai_match_category: matchPayload.category ?? null,
                    ai_match_action: matchPayload.action ?? null,
                    ai_match_readiness: matchPayload.readiness ?? null,
                    ai_match_display_category: matchPayload.displayCategory ?? null,
                  }
                : row
            )
          );
        } catch {
          /* upload already succeeded */
        }
      })();
    } catch (uploadError) {
      setResumeErrorMessage(
        uploadError instanceof Error ? uploadError.message : "Failed to upload resume"
      );
      setResumeErrorOpen(true);
    } finally {
      setResumeUploading(false);
    }
  }

  function beginArchiveCandidate(applicationId: string) {
    const archivedOption = statusOptions.find((option) => option.systemKey === "archived");
    if (!archivedOption) {
      toast.error("Archived status is not configured for this organization.");
      return;
    }
    const row = rows.find((item) => item.id === applicationId);
    if (!row) return;
    if (isRowArchived(row, statusOptions)) {
      toast.success("Candidate is already archived");
      return;
    }
    void applyApplicationStatus(applicationId, archivedOption, "Archived from candidates list", {
      switchToArchivedTab: true,
    });
  }

  function beginUnarchiveCandidate(applicationId: string) {
    const newOption = statusOptions.find((option) => option.systemKey === "new");
    if (!newOption) {
      toast.error("New status is not configured for this organization.");
      return;
    }
    const row = rows.find((item) => item.id === applicationId);
    if (!row) return;
    if (!isRowArchived(row, statusOptions)) {
      toast.success("Candidate is not archived");
      return;
    }
    void applyApplicationStatus(applicationId, newOption, "Restored from archive");
  }

  async function applyApplicationStatus(
    applicationId: string,
    toOption: ApplicationStatusOption,
    note?: string,
    options?: { switchToArchivedTab?: boolean }
  ) {
    if (statusBusyId) {
      toast.error("Please wait — a status update is already in progress.");
      return false;
    }
    const previousRow = rows.find((item) => item.id === applicationId);
    const wasArchived = previousRow ? isRowArchived(previousRow, statusOptions) : false;
    setStatusBusyId(applicationId);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            statusId: toOption.id,
            note: note?.trim() || undefined,
          }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to update status"
        );
      }
      const nextStatus = String(payload.application?.status ?? toOption.systemKey ?? "custom");
      const nextStatusId = String(payload.application?.statusId ?? toOption.id);
      const nextStatusName = String(payload.application?.statusName ?? toOption.name);
      setRows((current) =>
        current.map((row) =>
          row.id === applicationId
            ? {
                ...row,
                status: nextStatus,
                status_id: nextStatusId,
                statusName: nextStatusName,
                statusNote: note?.trim() || payload.history?.note || null,
                application_statuses: {
                  id: nextStatusId,
                  name: nextStatusName,
                  system_key: toOption.systemKey,
                  color: toOption.color,
                },
              }
            : row
        )
      );
      setPendingStatusChange(null);
      setStatusChangeNote("");
      if (toOption.systemKey === "archived") {
        const candidateLabel = previousRow ? applicantName(previousRow) : "Candidate";
        toast.success(`${candidateLabel} archived successfully`, { duration: ACTION_TOAST_DURATION_MS });
        if (options?.switchToArchivedTab) {
          window.setTimeout(() => {
            setActiveTab(toOption.id);
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", toOption.id);
            router.replace(`${pathname}?${params.toString()}`);
          }, 300);
        }
      } else if (wasArchived && toOption.systemKey !== "archived") {
        const candidateLabel = previousRow ? applicantName(previousRow) : "Candidate";
        toast.success(`${candidateLabel} restored from archive`, { duration: ACTION_TOAST_DURATION_MS });
      } else if (payload.unchanged) {
        toast.success("Status unchanged");
      } else {
        const candidateLabel = previousRow ? applicantName(previousRow) : "Candidate";
        toast.success(
          statusChangeSuccessMessage(toOption.systemKey, nextStatusName, candidateLabel),
          { duration: ACTION_TOAST_DURATION_MS }
        );
      }
      if (historyDialog?.applicationId === applicationId) {
        void loadStatusHistory(applicationId);
      }
      return true;
    } catch (updateError) {
      toast.error(
        updateError instanceof Error ? updateError.message : "Failed to update status"
      );
      return false;
    } finally {
      setStatusBusyId(null);
    }
  }

  async function handleScheduleInterview(payload: ScheduleInterviewPayload) {
    const row = actionRow();
    if (!row) return;
    setInterviewSubmitting(true);
    setInterviewError(null);
    try {
      const response = await fetch("/api/admin/applicant-appointments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          applicationId: row.id,
          jobId: jobId || row.job_requisition_id,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        statusUpdated?: boolean;
        invitation?: {
          sentCount: number;
          failedCount: number;
          skippedCount: number;
          invitationStatus: "sent" | "partial" | "failed" | "pending";
        };
      };
      if (!response.ok) throw new Error(data.error || "Failed to schedule interview");
      if (data.statusUpdated) {
        setRows((current) =>
          current.map((item) =>
            item.id === row.id ? { ...item, status: "interviewing" } : item
          )
        );
      }
      setInterviewOpen(false);
      setInterviewError(null);
      setActionTargetRowId(null);
      const candidateLabel = applicantName(row);
      toast.success(`${candidateLabel}: ${invitationSuccessMessage(data.invitation)}`, {
        duration: ACTION_TOAST_DURATION_MS,
      });
    } catch (scheduleError) {
      const message =
        scheduleError instanceof Error ? scheduleError.message : "Failed to schedule interview";
      setInterviewError(message);
      toast.error(message);
    } finally {
      setInterviewSubmitting(false);
    }
  }

  function beginQuickStatusChange(
    applicationId: string,
    systemKey: ApplicationPipelineStatus,
    note?: string
  ) {
    const option = statusOptions.find((item) => item.systemKey === systemKey);
    if (!option) {
      toast.error("That status is not configured for this organization.");
      return;
    }
    const row = rows.find((item) => item.id === applicationId);
    if (!row) return;
    if (rowStatusId(row) === option.id) {
      toast.success(`Candidate is already ${option.name.toLowerCase()}`);
      return;
    }
    void applyApplicationStatus(applicationId, option, note);
  }

  function beginStatusChange(applicationId: string, toOption: ApplicationStatusOption) {
    const row = rows.find((item) => item.id === applicationId);
    if (!row) return;
    if (rowStatusId(row) === toOption.id) {
      setStatusMenu(null);
      return;
    }
    setStatusMenu(null);
    setRowActionsMenu(null);
    setPendingStatusChange({
      applicationId,
      fromLabel: rowStatusName(row, statusOptions),
      toOption,
    });
    setStatusChangeNote("");
  }

  function beginStatusChangeBySystemKey(
    applicationId: string,
    systemKey: ApplicationPipelineStatus
  ) {
    const option = statusOptions.find((item) => item.systemKey === systemKey);
    if (!option) {
      toast.error("That status is not configured for this organization.");
      return;
    }
    beginStatusChange(applicationId, option);
  }

  async function confirmStatusChange() {
    if (!pendingStatusChange || statusBusyId) return;
    const { applicationId, toOption } = pendingStatusChange;
    await applyApplicationStatus(
      applicationId,
      toOption,
      statusChangeNote.trim() || undefined
    );
  }

  async function loadStatusHistory(applicationId: string) {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(
        `/api/admin/job-applications/${encodeURIComponent(applicationId)}/status-history`,
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string" ? payload.error : "Failed to load status history"
        );
      }
      setHistoryEntries(payload.history ?? []);
    } catch (err) {
      setHistoryEntries([]);
      setHistoryError(err instanceof Error ? err.message : "Failed to load status history");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openStatusHistory(row: ApplicationRow) {
    setHistoryDialog({
      applicationId: row.id,
      candidateName: applicantName(row),
    });
    await loadStatusHistory(row.id);
  }

  async function runMatchAnalyze(applicationId: string) {
    setMatchAnalyzingId(applicationId);
    const candidateLabel = applicantName(
      rows.find((row) => row.id === applicationId) ?? ({ id: applicationId } as ApplicationRow)
    );
    try {
      const response = await fetch(
        `/api/admin/job-applications/${applicationId}/match-analysis`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Match analysis failed");
      setRows((current) =>
        current.map((row) =>
          row.id === applicationId
            ? {
                ...row,
                ai_match_status: payload.status ?? row.ai_match_status,
                ai_match_score: payload.score ?? row.ai_match_score,
                ai_match_category: payload.category ?? row.ai_match_category,
                ai_match_action: payload.action ?? row.ai_match_action,
                ai_match_readiness: payload.readiness ?? row.ai_match_readiness,
                ai_match_display_category:
                  payload.analysis?.candidate_match?.display_category ??
                  row.ai_match_display_category,
              }
            : row
        )
      );
      if (payload.status === "NEEDS_REVIEW") {
        toast.error(payload.error || "Needs résumé text before analysis");
      } else {
        toast.success(`${candidateLabel}: match analysis complete`, {
          duration: ACTION_TOAST_DURATION_MS,
        });
      }
    } catch (analyzeError) {
      toast.error(
        analyzeError instanceof Error ? analyzeError.message : "Match analysis failed"
      );
    } finally {
      setMatchAnalyzingId(null);
    }
  }

  function renderCell(colId: ApplicationColumnId, row: ApplicationRow) {
    switch (colId) {
      case "candidates": {
        const name = applicantName(row);
        const workerId = resolveApplicationWorkerId(row);
        const detailHref = `/admin_recruiter/applications/review?jobId=${encodeURIComponent(row.job_requisition_id)}&applicationId=${encodeURIComponent(row.id)}`;
        const appliedJobCount = Number(row.appliedJobCount ?? 1);
        return (
          <div className="flex w-full min-w-0 items-center gap-3">
            <CandidateListAvatar name={name || "NA"} />
            <div className="min-w-0 flex-1">
              <Link
                href={detailHref}
                className="block truncate text-sm font-semibold leading-5 hover:underline"
                style={{ color: branding.secondaryHex || "#012352" }}
              >
                {name}
              </Link>
              {appliedJobCount > 1 ? (
                <span
                  className="mt-1 inline-flex rounded-[4px] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium leading-4"
                  style={{ color: branding.primaryHex || "var(--brand-primary)" }}
                >
                  Applied to {appliedJobCount} jobs
                </span>
              ) : null}
              {!jobId ? (
                <p className="mt-0.5 truncate text-[11px] leading-4 text-[#64748B]">
                  {String(one(row.job_requisitions).public_title ?? "").trim() || "Untitled job"}
                </p>
              ) : null}
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <CandidateAiFinalApprovalLink
                workerId={workerId}
                status={row.status}
                candidateName={name}
              />
            </div>
          </div>
        );
      }
      case "contact": {
        const email = applicantEmail(row);
        const phone = applicantPhone(row);
        const brandColor = branding.primaryHex || "var(--brand-primary)";
        return (
          <div className="flex min-w-0 flex-col gap-1 text-left">
            <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5" style={{ color: brandColor }}>
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span className="truncate">{email || "—"}</span>
            </p>
            <p className="flex min-w-0 items-center gap-1.5 text-sm leading-5">
              <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: brandColor }} aria-hidden />
              <span className="truncate text-[#374151]">{phone || "—"}</span>
            </p>
          </div>
        );
      }
      case "matches":
        return (
          <MatchScoreCell
            status={row.ai_match_status}
            score={row.ai_match_score}
            analyzing={matchAnalyzingId === row.id}
            onAnalyze={() => void runMatchAnalyze(row.id)}
          />
        );
      case "location": {
        const loc = applicantLocation(row);
        return <span className="text-sm leading-5 text-[#0F172A]">{loc || "—"}</span>;
      }
      case "activity":
        return <p className="text-sm leading-5 text-[#475569]">{formatActivity(row)}</p>;
      case "currentStage": {
        const stage = applicationCurrentStageMeta(row.status);
        const note = row.statusNote?.trim() || stage.subtitle;
        return (
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold leading-5 text-[#0F172A]">{stage.label}</p>
            {note ? (
              <p className="truncate text-xs leading-4 text-[#64748B]" title={note}>
                {note}
              </p>
            ) : null}
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full"
                style={{ width: `${stage.progress}%`, backgroundColor: stage.barColor }}
              />
            </div>
          </div>
        );
      }
      case "interest": {
        const currentStatus = normalizeApplicationStatus(row.status);
        const busy = statusBusyId === row.id;
        return (
          <div className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] px-1.5 py-1">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#16A34A] transition hover:bg-white"
              aria-label="Accept candidate"
              title="Accept"
              onClick={() => beginStatusChangeBySystemKey(row.id, "hired")}
              disabled={busy || currentStatus === "hired"}
            >
              <Check className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-white"
              aria-label="Mark as maybe"
              title="Maybe"
              onClick={() => beginStatusChangeBySystemKey(row.id, "undecided")}
              disabled={busy || currentStatus === "undecided"}
            >
              <HelpCircle className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#DC2626] transition hover:bg-white"
              aria-label="Reject candidate"
              title="Reject"
              onClick={() => beginStatusChangeBySystemKey(row.id, "rejected")}
              disabled={busy || currentStatus === "rejected"}
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        );
      }
      case "actions": {
        const menuOpen = rowActionsMenu?.rowId === row.id;
        const busy = statusBusyId === row.id;
        return (
          <div className="inline-flex items-center justify-center gap-2">
            <CandidateAiAnalysisButton
              applicationId={row.id}
              jobId={jobId || undefined}
              candidateName={applicantName(row)}
            />
            <button
              type="button"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9] ${
                menuOpen ? "bg-[#F1F5F9] ring-1 ring-[#CBD5E1]" : ""
              }`}
              aria-label="More actions"
              title="More actions"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              disabled={busy}
              onClick={(event) => {
                const anchor = event.currentTarget;
                setStatusMenu(null);
                setRowActionsMenu((current) =>
                  current?.rowId === row.id ? null : { rowId: row.id, anchor }
                );
              }}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        );
      }
      case "status": {
        const label = rowStatusName(row, statusOptions);
        const menuOpen = statusMenu?.rowId === row.id;
        const busy = statusBusyId === row.id;
        const customDot = rowStatusDotColor(row, statusOptions);
        return (
          <div className="inline-flex justify-center">
            <button
              type="button"
              disabled={busy || statusOptions.length === 0}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={(event) => {
                const anchor = event.currentTarget;
                setRowActionsMenu(null);
                setStatusMenu((current) =>
                  current?.rowId === row.id ? null : { rowId: row.id, anchor }
                );
              }}
              className={`inline-flex h-8 w-fit items-center justify-center gap-2 whitespace-nowrap px-2.5 text-sm text-[#334155] transition hover:bg-zinc-50 disabled:opacity-50 ${FORM_SURFACE_CLASS}`}
              title="Change status"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  customDot ? "" : applicationStatusDotClassName(row.status)
                }`}
                style={customDot ? { backgroundColor: customDot } : undefined}
                aria-hidden
              />
              <span className="max-w-[7.5rem] truncate">{label}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[#94A3B8] ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>
        );
      }
      case "email":
        return <span className="text-sm text-[#475569]">{applicantEmail(row) || "—"}</span>;
      case "workflow":
        return <span className="text-sm text-[#475569]">{workflowName(row)}</span>;
      case "dateApplied": {
        const applied = formatApplicationDate(row.submitted_at || row.created_at);
        return (
          <div className="text-center">
            <p className="text-sm font-medium leading-5 text-[#0F172A]">{applied.relative}</p>
            {applied.absolute && applied.absolute !== applied.relative ? (
              <p className="text-xs leading-4 text-[#64748B]">{applied.absolute}</p>
            ) : null}
          </div>
        );
      }
      case "evaluation": {
        const analyzed = row.ai_match_status === "ANALYZED";
        return (
          <span
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${
              analyzed ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F1F5F9] text-[#64748B]"
            }`}
          >
            {analyzed ? "Analyzed" : "Not Yet"}
          </span>
        );
      }
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
                    <div className="flex items-center gap-2">
                      <label className="relative block min-w-0 flex-1">
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
                      <button
                        type="button"
                        onClick={clearJobDropdownFilters}
                        className="shrink-0 px-1 text-sm font-bold whitespace-nowrap text-black transition hover:opacity-80"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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
                          className={`${FILTER_SELECT_CLASS} min-w-0 max-w-[120px] flex-1 sm:max-w-[140px] sm:flex-none`}
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
                      </div>

                      <div className="flex shrink-0 items-center justify-end gap-2 sm:ml-auto sm:gap-3">
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
                        <p className="inline-flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap text-[#64748B]">
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
                    </div>
                  </div>

                  <div className="border-b border-[#E5E7EB] px-3 py-3 sm:px-4">
                    <p className="text-sm font-semibold leading-5 text-[#1E293B]">
                      Candidates for all open and paused jobs
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <button
                      type="button"
                      role="option"
                      aria-selected={!jobId}
                      onClick={selectAllJobs}
                      className="flex w-full items-center gap-3 border-b border-[#E5E7EB] px-3 py-3.5 text-left transition hover:bg-[#F8FAFC] sm:px-4"
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        {!jobId ? (
                          <Check
                            className="h-5 w-5"
                            style={{ color: branding.primaryHex }}
                            strokeWidth={2.75}
                            aria-label="Selected all jobs"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-5 text-[#1E293B]">
                          All jobs
                        </span>
                        <span className="mt-0.5 block text-xs leading-4 text-[#64748B]">
                          Candidates across every job
                        </span>
                      </span>
                    </button>
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

            {jobId ? (
            <p className="inline-flex min-w-0 items-center gap-1.5 text-sm leading-5 text-[#64748B]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
              <span className="break-words">{jobLocation}</span>
            </p>
            ) : null}
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
          {statusTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    const params = new URLSearchParams(searchParams.toString());
                    if (tab.id === "all") params.delete("tab");
                    else params.set("tab", tab.id);
                    router.replace(`${pathname}?${params.toString()}`);
                  }}
                  className={`relative inline-flex shrink-0 flex-col items-center px-2 pb-2.5 pt-0 text-sm font-medium leading-none whitespace-nowrap transition-colors ${
                    active
                      ? "text-[color:var(--brand-primary)]"
                      : "text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{tab.label}</span>
                    <span className="admin-recruiter-tab-count rounded-sm">
                      {tabCounts[tab.id] ?? 0}
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
                  setPendingDeleteIds([]);
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>
            <button
              type="button"
              onClick={openAddCandidateModal}
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
            </button>
          </div>
          <HighlightMultiJobApplicantsRow
            on={highlightMultiJobApplicants}
            onToggle={() => setHighlightMultiJobApplicants((value) => !value)}
            activeColor={branding.secondaryHex}
            className="px-0 py-1"
          />
          {showFilterRows ? (
            <div className="grid grid-cols-1 gap-5 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 min-[450px]:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-medium leading-4 text-[#475569]">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "newest" | "oldest" | "matchScore" | "matchScoreAsc"
                    )
                  }
                  className={`${FILTER_SELECT_CLASS} h-10 w-full min-w-0`}
                  style={FILTER_SELECT_CHEVRON}
                  aria-label="Sort by"
                >
                  <option value="matchScore">Match % (Highest first)</option>
                  <option value="matchScoreAsc">Match % (Lowest first)</option>
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
                  setPendingDeleteIds([]);
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
              />
            </div>

            <button
              type="button"
              onClick={openAddCandidateModal}
              className={ADD_CANDIDATE_BUTTON_CLASS}
            >
              <Plus
                className="h-5 w-5 shrink-0"
                style={{ color: branding.secondaryHex }}
                strokeWidth={2}
                aria-hidden
              />
              Add candidate
            </button>
          </div>

          <HighlightMultiJobApplicantsRow
            on={highlightMultiJobApplicants}
            onToggle={() => setHighlightMultiJobApplicants((value) => !value)}
            activeColor={branding.secondaryHex}
          />

          <div className="border-b border-[#E5E7EB]" aria-hidden />

          {showFilterRows ? (
            <div className="flex w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-[#E5E7EB] px-[14px] py-3">
              <span className="shrink-0 text-sm text-[#64748B]">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as "newest" | "oldest" | "matchScore" | "matchScoreAsc"
                  )
                }
                className={FILTER_SELECT_CLASS}
                style={FILTER_SELECT_CHEVRON}
              >
                <option value="matchScore">Match % (Highest first)</option>
                <option value="matchScoreAsc">Match % (Lowest first)</option>
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
            <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-xs font-medium text-black">
              <tr>
                <th className="w-12 border-r border-[#E5E7EB] px-[14px] py-3">
                  <ListTableCheckbox
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible candidates"
                  />
                </th>
                {listColumns.map((colId) => {
                  const isMatchCol = colId === "matches";
                  const matchSortActive =
                    sortBy === "matchScore" || sortBy === "matchScoreAsc";
                  return (
                    <th
                      key={colId}
                      className={`border-r border-[#E5E7EB] px-[14px] py-3 font-medium normal-case tracking-normal last:border-r-0 ${applicationListColumnClassName(colId)}`}
                      aria-sort={
                        isMatchCol && matchSortActive
                          ? sortBy === "matchScore"
                            ? "descending"
                            : "ascending"
                          : undefined
                      }
                    >
                      {isMatchCol ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center gap-1 text-xs font-medium text-black transition hover:text-[#0F172A]"
                          onClick={() =>
                            setSortBy((current) =>
                              current === "matchScore" ? "matchScoreAsc" : "matchScore"
                            )
                          }
                          aria-label={
                            sortBy === "matchScore"
                              ? "Sort Match % lowest to highest"
                              : "Sort Match % highest to lowest"
                          }
                          title="Sort by Match %"
                        >
                          {applicationColumnLabel(colId)}
                          {sortBy === "matchScoreAsc" ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-[#64748B]" aria-hidden />
                          ) : (
                            <ArrowDown
                              className={`h-3.5 w-3.5 shrink-0 ${
                                matchSortActive ? "text-[#64748B]" : "text-[#CBD5E1]"
                              }`}
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : (
                        applicationColumnLabel(colId)
                      )}
                    </th>
                  );
                })}
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
                    className={`px-[14px] text-center text-[#64748B] ${
                      highlightMultiJobApplicants ? "py-24" : "py-12"
                    }`}
                  >
                    {highlightMultiJobApplicants
                      ? "No applicants have applied to multiple jobs."
                      : jobId
                        ? "No candidates match these filters."
                        : "No candidates in this status yet."}
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
        options={APPLICATION_EDITABLE_COLUMNS}
        value={listColumnOrder.filter((id) => id !== "actions")}
        title="Edit Columns"
        description="Choose which columns appear in the candidates list and drag to reorder them."
        onSave={(order) => {
          const next = ensureActionsLast(order);
          setListColumnOrder(next);
          saveApplicationColumnOrder(next);
        }}
      />

      {rowActionsMenu ? (
        <CandidateRowActionsMenu
          anchor={rowActionsMenu.anchor}
          analyzing={matchAnalyzingId === rowActionsMenu.rowId}
          hired={normalizeApplicationStatus(
            rows.find((item) => item.id === rowActionsMenu.rowId)?.status ?? ""
          ) === "hired"}
          archived={(() => {
            const row = rows.find((item) => item.id === rowActionsMenu.rowId);
            return row ? isRowArchived(row, statusOptions) : false;
          })()}
          resumeUploading={resumeUploading}
          onClose={() => setRowActionsMenu(null)}
          onReanalyze={() => {
            void runMatchAnalyze(rowActionsMenu.rowId);
          }}
          onUpdateResume={() => beginUpdateResume(rowActionsMenu.rowId)}
          onArchive={() => beginArchiveCandidate(rowActionsMenu.rowId)}
          onUnarchive={() => beginUnarchiveCandidate(rowActionsMenu.rowId)}
          onMessage={() => {
            const row = rows.find((item) => item.id === rowActionsMenu.rowId);
            if (!row) return;
            const workerId = resolveApplicationWorkerId(row);
            if (!workerId) {
              toast.error("Candidate profile is not linked yet");
              return;
            }
            setActionTargetRowId(row.id);
            setMessageOpen(true);
          }}
          onCall={() => {
            const row = rows.find((item) => item.id === rowActionsMenu.rowId);
            if (!row) return;
            const workerId = resolveApplicationWorkerId(row);
            if (!workerId) {
              toast.error("Candidate profile is not linked yet");
              return;
            }
            setActionTargetRowId(row.id);
            setCallOpen(true);
          }}
          onSetupInterview={() => {
            const row = rows.find((item) => item.id === rowActionsMenu.rowId);
            if (!row) return;
            const workerId = resolveApplicationWorkerId(row);
            if (!workerId) {
              toast.error("Candidate profile is not linked yet");
              return;
            }
            setActionTargetRowId(row.id);
            setInterviewError(null);
            setInterviewOpen(true);
          }}
          onDeleteCandidate={() => beginDeleteCandidate(rowActionsMenu.rowId)}
          onMarkAsHired={() =>
            beginQuickStatusChange(
              rowActionsMenu.rowId,
              "hired",
              "Marked as hired from candidates list"
            )
          }
        />
      ) : null}

      {statusMenu ? (
        <StatusDropdownPortal
          options={selectableStatusOptions}
          currentStatusId={(() => {
            const menuRow = rows.find((row) => row.id === statusMenu.rowId);
            return menuRow ? rowStatusId(menuRow) : null;
          })()}
          anchor={statusMenu.anchor}
          busy={statusBusyId === statusMenu.rowId}
          onClose={() => setStatusMenu(null)}
          onSelect={(option) => beginStatusChange(statusMenu.rowId, option)}
        />
      ) : null}

      <ApplicationStatusChangeModal
        open={Boolean(pendingStatusChange)}
        candidateName={
          pendingStatusChange
            ? applicantName(
                rows.find((row) => row.id === pendingStatusChange.applicationId) ??
                  ({
                    id: pendingStatusChange.applicationId,
                    status: "new",
                    created_at: "",
                    submitted_at: null,
                    job_requisition_id: "",
                    workflow_id: "",
                    applicant_workflow_instance_id: "",
                    job_requisitions: null,
                    onboarding_flows: null,
                    applicant_profiles: { first_name: "Candidate", last_name: "" },
                  } as ApplicationRow)
              )
            : ""
        }
        fromLabel={pendingStatusChange?.fromLabel ?? ""}
        toLabel={pendingStatusChange?.toOption.name ?? ""}
        note={statusChangeNote}
        busy={Boolean(pendingStatusChange && statusBusyId === pendingStatusChange.applicationId)}
        onNoteChange={setStatusChangeNote}
        onCancel={() => {
          if (statusBusyId) return;
          setPendingStatusChange(null);
          setStatusChangeNote("");
        }}
        onConfirm={() => void confirmStatusChange()}
      />

      <ApplicationStatusHistoryDialog
        open={Boolean(historyDialog)}
        candidateName={historyDialog?.candidateName ?? ""}
        loading={historyLoading}
        error={historyError}
        history={historyEntries}
        onClose={() => {
          setHistoryDialog(null);
          setHistoryEntries([]);
          setHistoryError(null);
        }}
      />

      <BulkDeleteConfirmModal
        open={deleteConfirmOpen}
        entity="candidate"
        count={pendingDeleteIds.length > 0 ? pendingDeleteIds.length : selectedIds.size}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setPendingDeleteIds([]);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDeleteCandidates()}
      />

      <input
        ref={resumeInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          void handleResumeFileSelected(file);
        }}
      />

      <ReplaceResumeConfirmModal
        open={Boolean(pendingResumeFile && pendingResumeApplicationId)}
        fileName={pendingResumeFile?.name ?? ""}
        busy={resumeUploading}
        hasExistingResume
        onCancel={() => {
          if (resumeUploading) return;
          setPendingResumeFile(null);
          setPendingResumeApplicationId(null);
        }}
        onConfirm={() => void confirmReplaceResumeFromList()}
      />

      <AddCandidateModal
        open={addCandidateOpen}
        onClose={() => setAddCandidateOpen(false)}
        jobId={jobId}
        jobTitle={jobTitle}
        onSuccess={() => setApplicationsRefreshNonce((value) => value + 1)}
      />

      <SuccessModal
        open={resumeSuccessOpen}
        onClose={() => setResumeSuccessOpen(false)}
        title="Success!"
        message="Resume updated successfully."
        size="large"
        actionLabel="Close"
        onAction={() => setResumeSuccessOpen(false)}
      />

      <ErrorModal
        open={resumeErrorOpen}
        onClose={() => {
          setResumeErrorOpen(false);
          setResumeErrorMessage("");
        }}
        title="Upload failed"
        message={resumeErrorMessage || "Failed to upload resume. Please try again."}
      />

      {resumeUploading ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-4 text-sm font-medium text-[#334155] shadow-lg">
            Uploading resume…
          </div>
        </div>
      ) : null}

      {(() => {
        const target = actionRow();
        if (!target) return null;
        const workerId = resolveApplicationWorkerId(target);
        if (!workerId) return null;
        const name = applicantName(target);
        const email = applicantEmail(target);
        const phone = applicantPhone(target);
        return (
          <>
            <CandidateCommunicationDialog
              open={messageOpen}
              onClose={() => {
                setMessageOpen(false);
                setActionTargetRowId(null);
              }}
              workerId={workerId}
              candidateName={name}
              email={email || null}
              phone={phone || null}
            />
            <AddCallLogModal
              open={callOpen}
              workerId={workerId}
              candidateName={name}
              onClose={() => {
                setCallOpen(false);
                setActionTargetRowId(null);
              }}
            />
            <ScheduleInterviewModal
              open={interviewOpen}
              applicants={[
                {
                  id: workerId,
                  name,
                  status: normalizeApplicationStatus(target.status),
                },
              ]}
              submitting={interviewSubmitting}
              error={interviewError}
              onClose={() => {
                setInterviewOpen(false);
                setInterviewError(null);
                setActionTargetRowId(null);
              }}
              onSubmit={(payload) => void handleScheduleInterview(payload)}
              fixedWorkerId={workerId}
              fixedApplicantName={name}
            />
          </>
        );
      })()}
    </div>
  );
}
