// app/admin_recruiter/candidates/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { EditColumnsModal } from "./EditColumnsModal";
import {
  columnLabel,
  candidateListColumnAlignmentClassName,
  candidateListColumnClassName,
  candidateListHeaderAlign,
  CANDIDATE_LIST_TABLE_CLASS,
  CANDIDATE_LIST_TABLE_SCROLL_CLASS,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "./column-config";
import { renderListCell } from "./render-list-cell";
import {
  mapWorkerProgressStatusFields,
  useCandidateProgressStatus,
} from "./CandidateProgressStatusCell";
import { CandidateGridCard } from "./CandidateGridCard";
import { CandidateListSortableHeader } from "./CandidateListSortableHeader";
import type { CandidateRow } from "./types";
import AdvancedSearchModal from "../components/AdvancedSearchModal";
import CandidateCommunicationDialog from "../components/CandidateCommunicationDialog";
import { CandidatesListShell } from "../components/CandidatesListShell";
import { BulkDeleteConfirmModal } from "../components/BulkDeleteConfirmModal";
import { ListTableCheckbox } from "../components/ListTableCheckbox";
import { exportCandidatesCsv, exportCandidatesXls } from "./export-candidates";
import { formatCandidateStatusLabel } from "./candidate-status-badge";
import { buildCandidateKpis } from "./candidate-kpis";
import { CandidateAiAnalysisLink } from "./CandidateAiAnalysisLink";
import { CandidateRowActionsMenu } from "../applications/CandidateRowActionsMenu";
import AddCandidateModal from "../applications/AddCandidateModal";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { jobListDisplayTitle, type JobListRow } from "../jobs/render-job-list-cell";
// import { countMultiJobApplicants } from "@/lib/admin/multi-job-applicants";
import { isWorkerClaimEligible } from "@/lib/candidates/claim";
import { matchesCandidateListSearch } from "@/lib/admin/candidate-list-search";
import {
  candidateMatchesJobTitleFilter,
  getCandidateJobTitleOptions,
} from "@/lib/admin/candidate-match-job-title";
import {
  ACTIVE_CANDIDATE_PIPELINE_STATUSES,
  formatPipelineStatusLabel,
} from "@/lib/workers/candidate-status-label";
import { matchesCandidateAppliedDateRange } from "@/lib/admin/candidate-applied-date-filter";
import { candidateMatchesMatchScoreFilter } from "@/lib/admin/candidate-match-score-filter";
import {
  buildCandidateStageOptions,
  candidateMatchesStageFilter,
} from "@/lib/admin/candidate-list-stage";
import {
  EMPTY_CANDIDATE_LIST_SORT,
  isCandidateListSortableColumn,
  sortCandidateRows,
  toggleCandidateListSort,
  type CandidateListSortColumn,
  type CandidateListSortState,
} from "@/lib/admin/candidate-list-sort";
import { useAdminHeaderData } from "@/lib/admin/hooks/use-admin-header-data";
import { usePageSelection } from "../hooks/usePageSelection";
import { CandidateBulkSelectionBar } from "../components/CandidateBulkSelectionBar";
import { ClaimCandidatesConfirmModal } from "../components/ClaimCandidatesConfirmModal";
import { postClaimCandidates } from "./claim-client";
import { runCandidateListBulkMatchAnalyze } from "./run-bulk-match-analyze";
import {
  parseListingRequirementCounts,
  requirementCountsFromAnalyzePayload,
} from "@/lib/jobs/match-analysis/workspace";
import {
  bulkAnalyzeSelectedLabel,
  bulkReanalyzeSelectedLabel,
  partitionMatchAnalysisTargets,
} from "@/lib/admin/bulk-match-analysis";
import { bulkArchiveApplications } from "@/lib/admin/bulk-archive-applications";
import {
  fetchAllWorkersFromApi,
  resolveCandidatesListTotal,
} from "@/lib/workers/candidates-list-fetch";
import toast from "react-hot-toast";

const ACTION_TOAST_DURATION_MS = 3500;
const ADD_CANDIDATE_BUTTON_CLASS =
  "inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm font-normal leading-5 text-[#525252] transition hover:bg-zinc-50 lg:w-auto lg:justify-start";

type WorkerProfile = {
  id: string;
  user_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  email: string | null;
  phone: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  applicant_email?: string | null;
  applicant_phone?: string | null;
  address1: string | null;
  address2?: string | null;
  city: string | null;
  state: string | null;
  zip?: string | null;
  created_at: string | null;
  status?: string | null;
  profile_photo?: string | null;
  profile_photo_url?: string | null;
  applied_job_count?: number | null;
  assigned_recruiter_user_id?: string | null;
  application_id?: string | null;
  application_status_id?: string | null;
  application_status_name?: string | null;
  application_status_key?: string | null;
  application_status_ambiguous?: boolean | null;
  application_job_title?: string | null;
  application_job_titles_text?: string | null;
  application_search_text?: string | null;
  match_application_id?: string | null;
  ai_match_status?: string | null;
  ai_match_score?: number | null;
  ai_match_category?: string | null;
  ai_match_display_category?: string | null;
  ai_requirement_counts?: {
    confirmed?: number | null;
    verify?: number | null;
    notMet?: number | null;
  } | null;
};

/** Fixed `en-US` locale so SSR and browser produce identical strings (avoids hydration mismatch). */
function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} • ${time}`;
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

const DEFAULT_PAGE_SIZE = 10;
const ADVANCED_SEARCH_STORAGE_KEY = "admin_recruiter_candidates_advanced_search";
type AdvancedSearchParams = { lat: number; lng: number; radius: number; place?: string };

function pickFirstNonEmpty(values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function resolveCandidateContact(item: WorkerProfile) {
  const emailCandidates = [
    { source: "candidate.email", value: item.email },
    { source: "worker.email", value: item.email },
    { source: "profile.email", value: item.user_email },
    { source: "applicant.email", value: item.applicant_email },
  ];
  const phoneCandidates = [
    { source: "candidate.phone", value: item.phone },
    { source: "worker.phone", value: item.phone },
    { source: "profile.phone", value: item.user_phone },
    { source: "applicant.phone", value: item.applicant_phone },
  ];
  const selectedEmail = pickFirstNonEmpty(emailCandidates.map((entry) => entry.value));
  const selectedPhone = pickFirstNonEmpty(phoneCandidates.map((entry) => entry.value));
  const emailSource =
    emailCandidates.find((entry) => typeof entry.value === "string" && entry.value.trim())?.source ?? "none";
  const phoneSource =
    phoneCandidates.find((entry) => typeof entry.value === "string" && entry.value.trim())?.source ?? "none";

  console.debug("[CandidatesCardContactDebug]", {
    candidate_id: item.id,
    worker_id: item.id,
    user_id: item.user_id ?? null,
    selected_email: selectedEmail || null,
    selected_phone: selectedPhone || null,
    email_source: emailSource,
    phone_source: phoneSource,
    raw_contact_fields: {
      worker_email: item.email ?? null,
      worker_phone: item.phone ?? null,
      profile_email: item.user_email ?? null,
      profile_phone: item.user_phone ?? null,
      applicant_email: item.applicant_email ?? null,
      applicant_phone: item.applicant_phone ?? null,
    },
  });

  return { email: selectedEmail, phone: selectedPhone };
}

function mapWorkerMatchFields(item: WorkerProfile) {
  return {
    matchApplicationId: item.match_application_id ?? item.application_id ?? null,
    aiMatchStatus: item.ai_match_status ?? null,
    aiMatchScore: item.ai_match_score ?? null,
    aiMatchCategory: item.ai_match_category ?? null,
    aiMatchDisplayCategory: item.ai_match_display_category ?? null,
    aiRequirementCounts: parseListingRequirementCounts(item.ai_requirement_counts),
  };
}

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const {
    statusOptions: progressStatusOptions,
    statusMenu: progressStatusMenu,
    setStatusMenu: setProgressStatusMenu,
    statusBusyWorkerId,
    progressStatusUi,
  } = useCandidateProgressStatus(candidates, setCandidates);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [progressStatusFilter, setProgressStatusFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [matchScoreFilter, setMatchScoreFilter] = useState("");
  const [listSort, setListSort] = useState<CandidateListSortState>(EMPTY_CANDIDATE_LIST_SORT);
  const [view, setView] = useState<"card" | "list">("list");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [advancedSearchParams, setAdvancedSearchParams] = useState<AdvancedSearchParams | null>(null);
  const [commTarget, setCommTarget] = useState<CandidateRow | null>(null);
  const [rowActionsMenu, setRowActionsMenu] = useState<{ rowId: string; anchor: HTMLElement } | null>(
    null
  );
  // Highlight Multi-Job Applicants is disabled on the legacy /admin_recruiter/candidates screen.
  // const [highlightMultiJob, setHighlightMultiJob] = useState(false);
  // const [filterMultiJobOnly, setFilterMultiJobOnly] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [claimConfirmOpen, setClaimConfirmOpen] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [matchAnalyzingApplicationIds, setMatchAnalyzingApplicationIds] = useState<Set<string>>(
    () => new Set()
  );
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [addCandidateJobs, setAddCandidateJobs] = useState<JobListRow[]>([]);
  const branding = useTenantBranding();
  const { userId: currentUserId, displayName: currentUserName } = useAdminHeaderData();
  const clearSelectionRef = useRef<() => void>(() => {});

  const advancedSearchContext = useMemo(() => {
    if (!advancedSearchParams) {
      return { active: false, lat: 0, lng: 0, radius: 0, place: "" };
    }
    return {
      active: true,
      lat: advancedSearchParams.lat,
      lng: advancedSearchParams.lng,
      radius: advancedSearchParams.radius,
      place: (advancedSearchParams.place ?? "").trim(),
    };
  }, [advancedSearchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(ADVANCED_SEARCH_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<AdvancedSearchParams>;
      const lat = Number(parsed.lat);
      const lng = Number(parsed.lng);
      const radius = Number(parsed.radius);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radius) && radius > 0) {
        setAdvancedSearchParams({
          lat,
          lng,
          radius,
          place: typeof parsed.place === "string" ? parsed.place : "",
        });
      }
    } catch {
      window.sessionStorage.removeItem(ADVANCED_SEARCH_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("advancedSearch") === "1") {
      setAdvancedSearchOpen(true);
      router.replace("/admin_recruiter/candidates");
    }
  }, [router]);

  const applyAdvancedSearchParams = useCallback((params: AdvancedSearchParams | null) => {
    setAdvancedSearchParams(params);
    if (typeof window === "undefined") return;
    if (!params) {
      window.sessionStorage.removeItem(ADVANCED_SEARCH_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(ADVANCED_SEARCH_STORAGE_KEY, JSON.stringify(params));
  }, []);

  useEffect(() => {
    setListColumnOrder(loadColumnOrder());
  }, []);

  const loadAddCandidateJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load jobs");
      setAddCandidateJobs((payload.jobs ?? []) as JobListRow[]);
    } catch {
      setAddCandidateJobs([]);
    }
  }, []);

  useEffect(() => {
    void loadAddCandidateJobs();
  }, [loadAddCandidateJobs]);

  const addCandidateJobOptions = useMemo(
    () =>
      addCandidateJobs
        .map((job) => ({
          id: job.id,
          title: jobListDisplayTitle(job),
        }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [addCandidateJobs]
  );

  const loadCandidates = useCallback(async (overrideAdvancedSearch?: AdvancedSearchParams | null) => {
    const activeSearch = overrideAdvancedSearch === undefined ? advancedSearchParams : overrideAdvancedSearch;
    setLoading(true);
    try {
      if (activeSearch) {
        const res = await fetch("/api/search-workers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lat: activeSearch.lat,
            lng: activeSearch.lng,
            radius: activeSearch.radius,
            ...(activeSearch.place ? { place: activeSearch.place } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to fetch search results");

        const rows: WorkerProfile[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.workers)
            ? data.workers
            : [];
        setTotalFromApi(rows.length);

        const mapped: CandidateRow[] = rows.map((item) => {
          const { email, phone } = resolveCandidateContact(item);
          return ({
          id: item.id,
          name: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
          firstName: item.first_name ?? "",
          lastName: item.last_name ?? "",
          role: item.job_role || "N/A",
          applicationJobTitle: item.application_job_title ?? null,
          applicationJobTitlesText: item.application_job_titles_text ?? null,
          applicationSearchText: item.application_search_text ?? null,
          email,
          phone,
          address: [item.address1, item.city, item.state].filter(Boolean).join(", "),
          city: item.city ?? "",
          state: item.state ?? "",
          zip: item.zip ?? "",
          address1: item.address1 ?? "",
          address2: item.address2 ?? "",
          status: formatCandidateStatusLabel(item.status as string | undefined),
          statusKey: item.status ?? null,
          ...mapWorkerProgressStatusFields(item),
          createdAt: item.created_at,
          reference: item.id.slice(0, 7).toUpperCase(),
          dateOfBirth: null,
          profilePhotoUrl: item.profile_photo_url ?? null,
          appliedJobCount: Number(item.applied_job_count ?? 1),
          assignedRecruiterUserId: item.assigned_recruiter_user_id ?? null,
          ...mapWorkerMatchFields(item),
          });
        });

        setCandidates(mapped);
        clearSelectionRef.current();
        setPage(1);
        return;
      }

      const { workers: rows, total } = await fetchAllWorkersFromApi<WorkerProfile>(
        "/api/workers?includePhotoUrls=1"
      );
      setTotalFromApi(total);

      const mapped: CandidateRow[] = rows.map((item) => {
        const { email, phone } = resolveCandidateContact(item);
        return ({
        id: item.id,
        name: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
        firstName: item.first_name ?? "",
        lastName: item.last_name ?? "",
        role: item.job_role || "N/A",
        applicationJobTitle: item.application_job_title ?? null,
        applicationJobTitlesText: item.application_job_titles_text ?? null,
        applicationSearchText: item.application_search_text ?? null,
        email,
        phone,
        address: [item.address1, item.city, item.state].filter(Boolean).join(", "),
        city: item.city ?? "",
        state: item.state ?? "",
        zip: item.zip ?? "",
        address1: item.address1 ?? "",
        address2: item.address2 ?? "",
        status: formatCandidateStatusLabel(item.status as string | undefined),
        statusKey: item.status ?? null,
        ...mapWorkerProgressStatusFields(item),
        createdAt: item.created_at,
        reference: item.id.slice(0, 7).toUpperCase(),
        dateOfBirth: null,
        profilePhotoUrl: item.profile_photo_url ?? null,
        appliedJobCount: Number(item.applied_job_count ?? 1),
        assignedRecruiterUserId: item.assigned_recruiter_user_id ?? null,
        ...mapWorkerMatchFields(item),
        });
      });

      setCandidates(mapped);
      clearSelectionRef.current();
      setPage(1);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setCandidates([]);
      setTotalFromApi(null);
      clearSelectionRef.current();
    } finally {
      setLoading(false);
    }
  }, [advancedSearchParams]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const jobRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) {
      if (c.role && c.role !== "N/A") s.add(c.role);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const c of candidates) {
      const loc = [c.city, c.state].filter(Boolean).join(", ");
      if (loc) s.add(loc);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const statusOptions = useMemo(() => {
    const canonical = new Set(
      ACTIVE_CANDIDATE_PIPELINE_STATUSES.map((status) => formatPipelineStatusLabel(status))
    );
    for (const c of candidates) {
      if (c.status) canonical.add(c.status);
    }
    return Array.from(canonical).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const jobOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const c of candidates) {
      for (const title of getCandidateJobTitleOptions(c)) {
        titles.add(title);
      }
    }
    return Array.from(titles).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const stageOptions = useMemo(() => buildCandidateStageOptions(candidates), [candidates]);

  const progressStatusFilterOptions = useMemo(
    () =>
      progressStatusOptions.map((option) => ({
        value: option.id,
        label: option.name,
      })),
    [progressStatusOptions]
  );

  const kpiCards = useMemo(() => buildCandidateKpis(candidates), [candidates]);

  const filtered = useMemo(() => {
    let out = candidates;
    const q = query.trim();
    if (q) {
      out = out.filter((c) => matchesCandidateListSearch(c, q));
    }
    if (jobRoleFilter) out = out.filter((c) => c.role === jobRoleFilter);
    if (statusFilter) out = out.filter((c) => c.status === statusFilter);
    if (progressStatusFilter) {
      out = out.filter((c) => c.progressStatusId === progressStatusFilter);
    }
    if (jobFilter) out = out.filter((c) => candidateMatchesJobTitleFilter(c, jobFilter));
    if (stageFilter) out = out.filter((c) => candidateMatchesStageFilter(c, stageFilter));
    if (matchScoreFilter) {
      out = out.filter((c) => candidateMatchesMatchScoreFilter(c.aiMatchScore, matchScoreFilter));
    }
    if (locationFilter) {
      out = out.filter((c) => [c.city, c.state].filter(Boolean).join(", ") === locationFilter);
    }
    if (appliedDateFrom || appliedDateTo) {
      out = out.filter((c) => matchesCandidateAppliedDateRange(c.createdAt, appliedDateFrom, appliedDateTo));
    }
    return out;
  }, [
    candidates,
    query,
    jobRoleFilter,
    statusFilter,
    progressStatusFilter,
    jobFilter,
    stageFilter,
    matchScoreFilter,
    locationFilter,
    appliedDateFrom,
    appliedDateTo,
  ]);

  // const multiJobApplicantCount = useMemo(
  //   () => countMultiJobApplicants(filtered, (candidate) => Number(candidate.appliedJobCount ?? 1)),
  //   [filtered]
  // );

  // const visibleCandidates = useMemo(() => {
  //   if (!filterMultiJobOnly) return filtered;
  //   return filtered.filter((candidate) => Number(candidate.appliedJobCount ?? 1) > 1);
  // }, [filtered, filterMultiJobOnly]);
  const visibleCandidates = filtered;

  const hasActiveListFilters = useMemo(
    () =>
      Boolean(
        query.trim() ||
          jobRoleFilter ||
          statusFilter ||
          progressStatusFilter ||
          jobFilter ||
          stageFilter ||
          matchScoreFilter ||
          locationFilter ||
          appliedDateFrom ||
          appliedDateTo
      ),
    [
      query,
      jobRoleFilter,
      statusFilter,
      progressStatusFilter,
      jobFilter,
      stageFilter,
      matchScoreFilter,
      locationFilter,
      appliedDateFrom,
      appliedDateTo,
    ]
  );

  const listDisplayTotal = useMemo(
    () =>
      resolveCandidatesListTotal({
        totalFromApi: advancedSearchContext.active ? null : totalFromApi,
        visibleCount: visibleCandidates.length,
        hasClientFilters: hasActiveListFilters || advancedSearchContext.active,
      }),
    [
      advancedSearchContext.active,
      totalFromApi,
      visibleCandidates.length,
      hasActiveListFilters,
    ]
  );

  useEffect(() => {
    setPage(1);
  }, [query, jobRoleFilter, statusFilter, progressStatusFilter, jobFilter, stageFilter, matchScoreFilter, locationFilter, appliedDateFrom, appliedDateTo, pageSize, listSort]);

  const sortedCandidates = useMemo(
    () => sortCandidateRows(visibleCandidates, listSort),
    [visibleCandidates, listSort]
  );

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedCandidates.slice(start, start + pageSize);
  }, [sortedCandidates, page, pageSize]);

  const handleListSort = useCallback((column: CandidateListSortColumn) => {
    setListSort((current) => toggleCandidateListSort(current, column));
  }, []);

  const pageSelectableRows = useMemo(
    () =>
      paginated.map((candidate) => {
        const eligibility = isWorkerClaimEligible({
          assignedRecruiterUserId: candidate.assignedRecruiterUserId,
          status: candidate.statusKey ?? candidate.status,
          currentUserId: currentUserId ?? "",
        });
        return { id: candidate.id, eligible: eligibility.eligible, reason: eligibility.reason };
      }),
    [paginated, currentUserId]
  );

  const eligibilityById = useMemo(() => {
    const map = new Map<string, { eligible: boolean; reason: string | null }>();
    for (const row of pageSelectableRows) {
      map.set(row.id, { eligible: row.eligible, reason: row.reason });
    }
    return map;
  }, [pageSelectableRows]);

  const selectionClearKey = useMemo(
    () =>
      [
        page,
        pageSize,
        query,
        jobRoleFilter,
        statusFilter,
        progressStatusFilter,
        jobFilter,
        stageFilter,
        matchScoreFilter,
        locationFilter,
        appliedDateFrom,
        appliedDateTo,
        advancedSearchContext.active ? "adv" : "std",
      ].join("|"),
    [
      page,
      pageSize,
      query,
      jobRoleFilter,
      statusFilter,
      progressStatusFilter,
      jobFilter,
      stageFilter,
      matchScoreFilter,
      locationFilter,
      appliedDateFrom,
      appliedDateTo,
      advancedSearchContext.active,
    ]
  );

  const selection = usePageSelection({
    pageRows: pageSelectableRows,
    clearKey: selectionClearKey,
  });
  clearSelectionRef.current = selection.clearSelection;

  const selectedCandidates = useMemo(
    () => candidates.filter((row) => selection.selectedIds.has(row.id)),
    [candidates, selection.selectedIds]
  );
  const { analyzeIds: selectedAnalyzeIds, reanalyzeIds: selectedReanalyzeIds } =
    partitionMatchAnalysisTargets(
      selectedCandidates.map((row) => ({
        applicationId: row.matchApplicationId,
        status: row.aiMatchStatus,
      }))
    );
  const bulkAnalyzeBusy = matchAnalyzingApplicationIds.size > 0;

  const exportCandidates = useMemo(() => {
    if (selection.selectedCount === 0) return visibleCandidates;
    const selected = visibleCandidates.filter((row) => selection.selectedIds.has(row.id));
    return selected.length > 0 ? selected : visibleCandidates;
  }, [visibleCandidates, selection.selectedCount, selection.selectedIds]);

  const handleExportCandidatesCsv = useCallback(() => {
    if (exportCandidates.length === 0) {
      toast.error("No candidates to export");
      return;
    }
    exportCandidatesCsv(exportCandidates, { columnOrder: listColumnOrder });
  }, [exportCandidates, listColumnOrder]);

  const handleExportCandidatesXls = useCallback(() => {
    if (exportCandidates.length === 0) {
      toast.error("No candidates to export");
      return;
    }
    exportCandidatesXls(exportCandidates, { columnOrder: listColumnOrder });
  }, [exportCandidates, listColumnOrder]);

  async function handleBulkArchiveSelected() {
    const applicationIds = selectedCandidates
      .map((row) => row.matchApplicationId?.trim() ?? "")
      .filter(Boolean);
    if (archiveBusy) return;
    if (applicationIds.length === 0) {
      toast.error("Selected candidates have no linked job applications to archive.");
      return;
    }
    setArchiveBusy(true);
    try {
      const { archived, failed } = await bulkArchiveApplications(applicationIds);
      if (archived > 0) {
        toast.success(`Archived ${archived} candidate${archived === 1 ? "" : "s"}`, {
          duration: ACTION_TOAST_DURATION_MS,
        });
        if (advancedSearchContext.active) {
          void loadCandidates(null);
        } else {
          void loadCandidates();
        }
        selection.clearSelection();
      } else if (failed === 0) {
        toast.success("No candidates needed archiving");
      }
      if (failed > 0) {
        toast.error(`Failed to archive ${failed} candidate${failed === 1 ? "" : "s"}`);
      }
    } catch (archiveErr) {
      toast.error(
        archiveErr instanceof Error ? archiveErr.message : "Failed to archive candidates"
      );
    } finally {
      setArchiveBusy(false);
    }
  }

  async function runSelectedMatchAnalyze(applicationIds: string[]) {
    if (bulkAnalyzeBusy) return;
    await runCandidateListBulkMatchAnalyze({
      applicationIds,
      setCandidates,
      setAnalyzingIds: setMatchAnalyzingApplicationIds,
    });
  }

  function openClaimConfirm() {
    if (selection.selectedEligibleCount === 0) {
      toast("Select eligible unclaimed candidates first.");
      return;
    }
    setClaimError(null);
    setClaimConfirmOpen(true);
  }

  async function runMatchAnalyze(applicationId: string) {
    const candidate = candidates.find((row) => row.matchApplicationId === applicationId);
    setMatchAnalyzingApplicationIds((current) => new Set(current).add(applicationId));
    try {
      const response = await fetch(`/api/admin/job-applications/${applicationId}/match-analysis`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Match analysis failed");
      setCandidates((current) =>
        current.map((row) =>
          row.matchApplicationId === applicationId
            ? {
                ...row,
                aiMatchStatus: payload.status ?? row.aiMatchStatus,
                aiMatchScore: payload.score ?? row.aiMatchScore,
                aiMatchCategory: payload.category ?? row.aiMatchCategory,
                aiMatchDisplayCategory:
                  payload.analysis?.candidate_match?.display_category ?? row.aiMatchDisplayCategory,
                aiRequirementCounts:
                  requirementCountsFromAnalyzePayload(payload) ?? row.aiRequirementCounts,
              }
            : row
        )
      );
      if (payload.status === "NEEDS_REVIEW") {
        toast.error(payload.error || "Needs résumé text before analysis");
      } else {
        toast.success(`${candidate?.name || "Candidate"}: match analysis complete`, {
          duration: ACTION_TOAST_DURATION_MS,
        });
      }
    } catch (analyzeError) {
      toast.error(analyzeError instanceof Error ? analyzeError.message : "Match analysis failed");
    } finally {
      setMatchAnalyzingApplicationIds((current) => {
        const next = new Set(current);
        next.delete(applicationId);
        return next;
      });
    }
  }

  async function confirmClaimCandidates() {
    if (claimBusy || selection.selectedEligibleIds.length === 0) return;
    setClaimBusy(true);
    setClaimError(null);
    try {
      const result = await postClaimCandidates(selection.selectedEligibleIds);
      toast.success(result.summary);
      const claimed = new Set(result.claimed);
      const ownerId = result.recruiter?.id ?? currentUserId;
      const ownerName = result.recruiter?.name ?? currentUserName ?? "You";
      if (claimed.size > 0) {
        setCandidates((current) =>
          current.map((row) =>
            claimed.has(row.id)
              ? {
                  ...row,
                  assignedRecruiterUserId: ownerId,
                  assignedRecruiterName: ownerName,
                }
              : row
          )
        );
      }
      // Clear successful claims; keep failed/not-found for retry.
      selection.removeIds([...result.claimed, ...result.already_claimed, ...result.ineligible]);
      if (result.failed.length === 0 && result.not_found.length === 0) {
        selection.clearSelection();
        setClaimConfirmOpen(false);
      }
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Failed to claim candidates");
    } finally {
      setClaimBusy(false);
    }
  }

  async function handleConfirmDeleteCandidates() {
    const idsToDelete = [...selection.selectedIds];
    if (deleteBusy || idsToDelete.length === 0) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch("/api/admin/workers", {
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
        Array.isArray(payload.deletedIds) ? payload.deletedIds.map(String) : idsToDelete
      );
      setCandidates((current) => current.filter((row) => !deletedIds.has(row.id)));
      setTotalFromApi((current) =>
        typeof current === "number" ? Math.max(0, current - deletedIds.size) : current
      );
      selection.removeIds(deletedIds);
      setDeleteConfirmOpen(false);
      const deletedCount =
        typeof payload.count === "number" ? payload.count : deletedIds.size;
      toast.success(`Deleted ${deletedCount} candidate${deletedCount === 1 ? "" : "s"}`, {
        duration: ACTION_TOAST_DURATION_MS,
      });
    } catch (deleteErr) {
      const message =
        deleteErr instanceof Error ? deleteErr.message : "Failed to delete candidates";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <CandidatesListShell
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => {
          if (advancedSearchContext.active) {
            applyAdvancedSearchParams(null);
            void loadCandidates(null);
            return;
          }
          void loadCandidates();
        }}
        refreshLabel={advancedSearchContext.active ? "Reset Search" : "Refresh"}
        jobRoleFilter={jobRoleFilter}
        onJobRoleFilterChange={setJobRoleFilter}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        appliedDateFrom={appliedDateFrom}
        appliedDateTo={appliedDateTo}
        onAppliedDateFromChange={setAppliedDateFrom}
        onAppliedDateToChange={setAppliedDateTo}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        progressStatusFilter={progressStatusFilter}
        onProgressStatusFilterChange={setProgressStatusFilter}
        progressStatusOptions={progressStatusFilterOptions}
        jobFilter={jobFilter}
        onJobFilterChange={setJobFilter}
        jobOptions={jobOptions}
        stageFilter={stageFilter}
        onStageFilterChange={setStageFilter}
        stageOptions={stageOptions}
        matchScoreFilter={matchScoreFilter}
        onMatchScoreFilterChange={setMatchScoreFilter}
        jobRoleOptions={jobRoleOptions}
        locationOptions={locationOptions}
        kpiCards={kpiCards}
        hideAddCandidate
        hideClaimCandidates
        hideRefresh
        simplifiedToolbarFilters
        toolbarAddCandidateButton={
          <button
            type="button"
            onClick={() => setAddCandidateOpen(true)}
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
        }
        view={view}
        onViewChange={setView}
        onEditColumns={() => setEditColumnsOpen(true)}
        onAdvancedSearch={() => setAdvancedSearchOpen(true)}
        totalCount={listDisplayTotal}
        loading={loading}
        totalLabel="applicants"
        advancedSearchActive={advancedSearchContext.active}
        advancedSearchPlace={advancedSearchContext.place}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        totalFiltered={listDisplayTotal}
        showMultiJobHighlight={false}
      >
        {(() => {
          const formatDate = formatDateShort;

          if (loading) {
            return null;
          }
          if (visibleCandidates.length === 0) {
            return (
              <div className="py-12 text-center text-gray-600">
                <div>No candidates found.</div>
                {advancedSearchContext.active ? (
                  <button
                    type="button"
                    onClick={() => {
                      applyAdvancedSearchParams(null);
                      void loadCandidates(null);
                    }}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-[color:var(--brand-primary)] px-5 text-sm font-semibold text-white hover:brightness-95"
                  >
                    Reset Search
                  </button>
                ) : null}
              </div>
            );
          }

          if (view === "list") {
            const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_CANDIDATE_COLUMNS;
            return (
              <div className="w-full">
                <CandidateBulkSelectionBar
                  selectedCount={selection.selectedCount}
                  eligibleCount={selection.selectedEligibleCount}
                  scopeLabel={selection.selectionScopeLabel}
                  claimBusy={claimBusy}
                  analyzeBusy={bulkAnalyzeBusy}
                  archiveBusy={archiveBusy}
                  deleteBusy={deleteBusy}
                  analyzeLabel={bulkAnalyzeSelectedLabel(selectedAnalyzeIds.length)}
                  reanalyzeLabel={bulkReanalyzeSelectedLabel(selectedReanalyzeIds.length)}
                  onAnalyze={
                    selectedAnalyzeIds.length > 0
                      ? () => void runSelectedMatchAnalyze(selectedAnalyzeIds)
                      : selection.selectedCount > 0 && selectedReanalyzeIds.length === 0
                        ? () => void runSelectedMatchAnalyze([])
                        : undefined
                  }
                  onReanalyze={
                    selectedReanalyzeIds.length > 0
                      ? () => void runSelectedMatchAnalyze(selectedReanalyzeIds)
                      : undefined
                  }
                  onArchive={() => void handleBulkArchiveSelected()}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleteConfirmOpen(true);
                  }}
                  onExportCsv={handleExportCandidatesCsv}
                  onExportXls={handleExportCandidatesXls}
                  exportDisabled={exportCandidates.length === 0}
                  hideClaim
                  onClear={selection.clearSelection}
                />
                <div className={CANDIDATE_LIST_TABLE_SCROLL_CLASS}>
                  <table className={CANDIDATE_LIST_TABLE_CLASS}>
                    <thead className="bg-brand-lite text-black">
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="w-12 border-r border-[#E5E7EB] bg-brand-lite px-3 py-3 text-center">
                          <ListTableCheckbox
                            size="md"
                            checked={selection.headerChecked}
                            indeterminate={selection.headerIndeterminate}
                            disabled={pageSelectableRows.every((row) => !row.eligible)}
                            onChange={selection.toggleAllEligibleOnPage}
                            aria-label="Select all eligible candidates on this page"
                          />
                        </th>
                        {cols.map((colId) => (
                          <th
                            key={colId}
                            className={`border-r border-[#E5E7EB] bg-brand-lite px-4 py-3 text-sm font-medium normal-case tracking-normal text-black first:pl-6 ${candidateListColumnAlignmentClassName(colId)} ${candidateListColumnClassName(colId)}`}
                          >
                            {isCandidateListSortableColumn(colId) ? (
                              <CandidateListSortableHeader
                                column={colId}
                                label={columnLabel(colId)}
                                align={candidateListHeaderAlign(colId)}
                                sort={listSort}
                                onSort={handleListSort}
                              />
                            ) : (
                              columnLabel(colId)
                            )}
                          </th>
                        ))}
                        <th className="whitespace-nowrap border-r-0 bg-brand-lite px-4 py-3 text-center text-sm font-medium normal-case tracking-normal text-black last:pr-6">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((c) => {
                        const eligibility = eligibilityById.get(c.id) ?? {
                          eligible: true,
                          reason: null,
                        };
                        return (
                        <tr key={c.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                          <td
                            className="w-12 border-r border-[#EEF2F7] px-3 py-4 text-center align-middle"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <ListTableCheckbox
                              size="md"
                              checked={selection.selectedIds.has(c.id)}
                              disabled={!eligibility.eligible}
                              title={eligibility.reason ?? undefined}
                              onChange={() => selection.toggleOne(c.id, eligibility.eligible)}
                              aria-label={`Select ${c.name || "candidate"}`}
                            />
                          </td>
                          {cols.map((colId) => (
                            <td
                              key={colId}
                              className={`border-r border-[#EEF2F7] px-4 py-4 align-middle first:pl-6 ${candidateListColumnAlignmentClassName(colId)} ${candidateListColumnClassName(colId)}`}
                            >
                              {renderListCell(colId, c, formatDate, {
                                matchAnalyzingApplicationIds,
                                onAnalyzeMatch: (applicationId) => void runMatchAnalyze(applicationId),
                                progressStatusOptions,
                                progressStatusMenuWorkerId: progressStatusMenu?.workerId ?? null,
                                progressStatusBusyWorkerId: statusBusyWorkerId,
                                onToggleProgressStatusMenu: (workerId, anchor) => {
                                  setRowActionsMenu(null);
                                  setProgressStatusMenu((current) =>
                                    current?.workerId === workerId ? null : { workerId, anchor }
                                  );
                                },
                              })}
                            </td>
                          ))}
                          <td className="border-r-0 px-4 py-4 align-middle last:pr-6">
                            <div className="flex items-center justify-center gap-2">
                              <CandidateAiAnalysisLink
                                workerId={c.id}
                                candidateName={c.name}
                              />
                              <button
                                type="button"
                                aria-label={`Actions for ${c.name || "candidate"}`}
                                aria-expanded={rowActionsMenu?.rowId === c.id}
                                onClick={(event) => {
                                  const anchor = event.currentTarget;
                                  setProgressStatusMenu(null);
                                  setRowActionsMenu((current) =>
                                    current?.rowId === c.id ? null : { rowId: c.id, anchor }
                                  );
                                }}
                                className="inline-flex size-[18px] items-center justify-center overflow-hidden"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src="/icons/admin-recruiter/candidates/three-dot.svg"
                                  alt=""
                                  width={16}
                                  height={16}
                                  className="size-4"
                                />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 gap-4 px-3 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
              {paginated.map((c) => (
                <CandidateGridCard
                  key={c.id}
                  candidate={c}
                  formatDateTime={formatDateTime}
                  onMessage={setCommTarget}
                />
              ))}
            </div>
          );
        })()}
      </CandidatesListShell>

      <EditColumnsModal
        key={editColumnsOpen ? "edit-cols-open" : "edit-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        value={listColumnOrder}
        onSave={(order) => {
          setListColumnOrder(order);
          saveColumnOrder(order);
        }}
      />
      {progressStatusUi}
      <BulkDeleteConfirmModal
        open={deleteConfirmOpen}
        entity="candidate"
        count={selection.selectedCount}
        busy={deleteBusy}
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteConfirmOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDeleteCandidates()}
      />
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        initialParams={
          advancedSearchContext.active
            ? {
                lat: advancedSearchContext.lat,
                lng: advancedSearchContext.lng,
                radius: advancedSearchContext.radius,
                place: advancedSearchContext.place,
              }
            : undefined
        }
        onViewResults={(params) => {
          const nextParams: AdvancedSearchParams = {
            lat: params.lat,
            lng: params.lng,
            radius: params.radius,
            ...(params.place ? { place: params.place } : {}),
          };
          applyAdvancedSearchParams(nextParams);
          void loadCandidates(nextParams);
          router.replace("/admin_recruiter/candidates");
          setAdvancedSearchOpen(false);
        }}
      />

      {rowActionsMenu ? (
        <CandidateRowActionsMenu
          anchor={rowActionsMenu.anchor}
          hired={(() => {
            const status = candidates.find((item) => item.id === rowActionsMenu.rowId)?.status ?? "";
            const normalized = status.trim().toLowerCase().replace(/\s+/g, "_");
            return normalized === "hired" || normalized === "converted";
          })()}
          onClose={() => setRowActionsMenu(null)}
          onReanalyze={() => toast("Reanalyze is available from the candidate application.")}
          onUpdateResume={() => toast("Update resume from the candidate profile.")}
          onArchive={() => toast("Archive is available from the candidate application.")}
          onUnarchive={() => toast("Unarchive is available from the candidate application.")}
          onMessage={() => {
            const row = candidates.find((item) => item.id === rowActionsMenu.rowId);
            if (row) setCommTarget(row);
          }}
          onCall={() => {
            const row = candidates.find((item) => item.id === rowActionsMenu.rowId);
            if (row?.phone) {
              window.location.href = `tel:${row.phone}`;
              return;
            }
            toast("No phone number on file for this candidate.");
          }}
          onSetupInterview={() => toast("Set up interview from the candidate application.")}
          onViewStatusHistory={() => toast("Status history is available from the candidate application.")}
          onDeleteCandidate={() => toast("Delete candidate from the candidate application.")}
          onMarkAsHired={() => toast("Mark as hired from the candidate application.")}
        />
      ) : null}

      {commTarget ? (
        <CandidateCommunicationDialog
          open={Boolean(commTarget)}
          onClose={() => setCommTarget(null)}
          workerId={commTarget.id}
          candidateName={commTarget.name || "Candidate"}
          email={commTarget.email}
          phone={commTarget.phone}
        />
      ) : null}

      <ClaimCandidatesConfirmModal
        open={claimConfirmOpen}
        selectedCount={selection.selectedCount}
        eligibleCount={selection.selectedEligibleCount}
        excludedCount={Math.max(0, selection.selectedCount - selection.selectedEligibleCount)}
        recruiterName={currentUserName?.trim() || "You"}
        busy={claimBusy}
        error={claimError}
        onCancel={() => {
          if (claimBusy) return;
          setClaimConfirmOpen(false);
          setClaimError(null);
        }}
        onConfirm={() => void confirmClaimCandidates()}
      />

      <AddCandidateModal
        open={addCandidateOpen}
        onClose={() => setAddCandidateOpen(false)}
        jobOptions={addCandidateJobOptions}
        onSuccess={() => {
          if (advancedSearchContext.active) {
            void loadCandidates(null);
            return;
          }
          void loadCandidates();
        }}
      />
    </>
  );
}
