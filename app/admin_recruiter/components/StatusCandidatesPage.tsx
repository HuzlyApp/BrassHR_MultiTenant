"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidatesListShell } from "./CandidatesListShell";
import { ListTableCheckbox } from "./ListTableCheckbox";
import AdvancedSearchModal from "./AdvancedSearchModal";
import { exportCandidatesCsv, exportCandidatesXls } from "../candidates/export-candidates";
import { EditColumnsModal } from "../candidates/EditColumnsModal";
import {
  columnLabel,
  candidateListColumnAlignmentClassName,
  candidateListColumnClassName,
  CANDIDATE_LIST_TABLE_CLASS,
  CANDIDATE_LIST_TABLE_SCROLL_CLASS,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "../candidates/column-config";
import { renderListCell } from "../candidates/render-list-cell";
import { CandidateGridCard } from "../candidates/CandidateGridCard";
import type { CandidateRow } from "../candidates/types";
import { formatCandidateStatusLabel } from "../candidates/candidate-status-badge";
import { buildCandidateKpis } from "../candidates/candidate-kpis";
import { isWorkerClaimEligible } from "@/lib/candidates/claim";
import { matchesCandidateListSearch } from "@/lib/admin/candidate-list-search";
import { matchesCandidateAppliedDateRange } from "@/lib/admin/candidate-applied-date-filter";
import {
  fetchAllWorkersFromApi,
  resolveCandidatesListTotal,
} from "@/lib/workers/candidates-list-fetch";
import { useAdminHeaderData } from "@/lib/admin/hooks/use-admin-header-data";
import { usePageSelection } from "../hooks/usePageSelection";
import { CandidateBulkSelectionBar } from "./CandidateBulkSelectionBar";
import { BulkDeleteConfirmModal } from "./BulkDeleteConfirmModal";
import { ClaimCandidatesConfirmModal } from "./ClaimCandidatesConfirmModal";
import { postClaimCandidates } from "../candidates/claim-client";
import { runCandidateListBulkMatchAnalyze } from "../candidates/run-bulk-match-analyze";
import {
  bulkAnalyzeSelectedLabel,
  bulkReanalyzeSelectedLabel,
  partitionMatchAnalysisTargets,
} from "@/lib/admin/bulk-match-analysis";
import { bulkArchiveApplications } from "@/lib/admin/bulk-archive-applications";
import toast from "react-hot-toast";

const ACTION_TOAST_DURATION_MS = 3500;

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
  application_status_name?: string | null;
  profile_photo?: string | null;
  profile_photo_url?: string | null;
  assigned_recruiter_user_id?: string | null;
  application_id?: string | null;
  application_job_title?: string | null;
  application_job_titles_text?: string | null;
  application_search_text?: string | null;
  match_application_id?: string | null;
  ai_match_status?: string | null;
  ai_match_score?: number | null;
  ai_match_category?: string | null;
  ai_match_display_category?: string | null;
};

type StatusCandidatesPageProps = {
  fetchUrl: string;
  statusLabel: string;
  emptyMessage: string;
};

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

  console.debug("[StatusCandidatesCardContactDebug]", {
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
  };
}

export function StatusCandidatesPage({ fetchUrl, statusLabel, emptyMessage }: StatusCandidatesPageProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"card" | "list">("list");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [claimConfirmOpen, setClaimConfirmOpen] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [matchAnalyzingApplicationIds, setMatchAnalyzingApplicationIds] = useState<Set<string>>(
    () => new Set()
  );
  const { userId: currentUserId, displayName: currentUserName } = useAdminHeaderData();

  useEffect(() => {
    setListColumnOrder(loadColumnOrder());
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = fetchUrl.includes("includePhotoUrls=")
        ? fetchUrl
        : `${fetchUrl}${fetchUrl.includes("?") ? "&" : "?"}includePhotoUrls=1`;

      const { workers: rows, total } = await fetchAllWorkersFromApi<WorkerProfile>(baseUrl);
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
        status: item.application_status_name?.trim()
          || formatCandidateStatusLabel(item.status ?? statusLabel),
        statusKey: item.status ?? null,
        createdAt: item.created_at,
        reference: item.id.slice(0, 7).toUpperCase(),
        dateOfBirth: null,
        profilePhotoUrl: item.profile_photo_url ?? null,
        assignedRecruiterUserId: item.assigned_recruiter_user_id ?? null,
        ...mapWorkerMatchFields(item),
        });
      });

      setCandidates(mapped);
      setPage(1);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setCandidates([]);
      setTotalFromApi(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, statusLabel]);

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
    const s = new Set<string>();
    for (const c of candidates) {
      if (c.status) s.add(c.status);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [candidates]);

  const kpiCards = useMemo(() => buildCandidateKpis(candidates), [candidates]);

  const filtered = useMemo(() => {
    let out = candidates;
    const q = query.trim();
    if (q) {
      out = out.filter((c) => matchesCandidateListSearch(c, q));
    }
    if (jobRoleFilter) out = out.filter((c) => c.role === jobRoleFilter);
    if (statusFilter) out = out.filter((c) => c.status === statusFilter);
    if (locationFilter) {
      out = out.filter((c) => [c.city, c.state].filter(Boolean).join(", ") === locationFilter);
    }
    if (appliedDateFrom || appliedDateTo) {
      out = out.filter((c) => matchesCandidateAppliedDateRange(c.createdAt, appliedDateFrom, appliedDateTo));
    }
    return out;
  }, [candidates, query, jobRoleFilter, statusFilter, locationFilter, appliedDateFrom, appliedDateTo]);

  const hasActiveListFilters = useMemo(
    () =>
      Boolean(
        query.trim() ||
          jobRoleFilter ||
          statusFilter ||
          locationFilter ||
          appliedDateFrom ||
          appliedDateTo
      ),
    [query, jobRoleFilter, statusFilter, locationFilter, appliedDateFrom, appliedDateTo]
  );

  const listDisplayTotal = useMemo(
    () =>
      resolveCandidatesListTotal({
        totalFromApi,
        visibleCount: filtered.length,
        hasClientFilters: hasActiveListFilters,
      }),
    [totalFromApi, filtered.length, hasActiveListFilters]
  );

  useEffect(() => {
    setPage(1);
  }, [query, jobRoleFilter, statusFilter, locationFilter, appliedDateFrom, appliedDateTo, pageSize]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

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
    () => [page, pageSize, query, jobRoleFilter, statusFilter, locationFilter, appliedDateFrom, appliedDateTo].join("|"),
    [page, pageSize, query, jobRoleFilter, statusFilter, locationFilter, appliedDateFrom, appliedDateTo]
  );

  const selection = usePageSelection({
    pageRows: pageSelectableRows,
    clearKey: selectionClearKey,
  });

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
    if (selection.selectedCount === 0) return filtered;
    const selected = filtered.filter((row) => selection.selectedIds.has(row.id));
    return selected.length > 0 ? selected : filtered;
  }, [filtered, selection.selectedCount, selection.selectedIds]);

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
        void loadCandidates();
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
              }
            : row
        )
      );
      if (payload.status === "NEEDS_REVIEW") {
        toast.error(payload.error || "Needs résumé text before analysis");
      } else {
        toast.success(`${candidate?.name || "Candidate"}: match analysis complete`);
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

  return (
    <>
      <CandidatesListShell
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => void loadCandidates()}
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
        jobRoleOptions={jobRoleOptions}
        locationOptions={locationOptions}
        kpiCards={kpiCards}
        hideAddCandidate
        hideClaimCandidates
        exportInToolbar
        view={view}
        onViewChange={setView}
        onEditColumns={() => setEditColumnsOpen(true)}
        onExportCsv={handleExportCandidatesCsv}
        onExportXls={handleExportCandidatesXls}
        onAdvancedSearch={() => setAdvancedSearchOpen(true)}
        totalCount={listDisplayTotal}
        loading={loading}
        totalLabel={`${statusLabel} applicants`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        totalFiltered={listDisplayTotal}
      >
        {(() => {
          const formatDate = formatDateShort;

          if (loading) {
            return null;
          }
          if (filtered.length === 0) {
            return <div className="py-24 text-center text-gray-600">{emptyMessage}</div>;
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
                    <thead className="bg-[#F8FAFC] text-black">
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="w-12 border-r border-[#E5E7EB] bg-[#E5E7EB] px-3 py-3 text-center">
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
                            className={`border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-sm font-medium uppercase tracking-[0.08em] text-black last:border-r-0 first:pl-6 last:pr-6 ${candidateListColumnAlignmentClassName(colId)} ${candidateListColumnClassName(colId)}`}
                          >
                            {columnLabel(colId)}
                          </th>
                        ))}
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
                              className={`border-r border-[#EEF2F7] px-4 py-4 align-middle last:border-r-0 first:pl-6 last:pr-6 ${candidateListColumnAlignmentClassName(colId)} ${candidateListColumnClassName(colId)}`}
                            >
                              {renderListCell(colId, c, formatDate, {
                                matchAnalyzingApplicationIds,
                                onAnalyzeMatch: (applicationId) => void runMatchAnalyze(applicationId),
                              })}
                            </td>
                          ))}
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
                  statusBadgeRounded="sm"
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

      <AdvancedSearchModal
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        onViewResults={(params) => {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              ADVANCED_SEARCH_STORAGE_KEY,
              JSON.stringify({
                lat: params.lat,
                lng: params.lng,
                radius: params.radius,
                ...(params.place ? { place: params.place } : {}),
              })
            );
          }
          setAdvancedSearchOpen(false);
          router.push("/admin_recruiter/candidates");
        }}
      />

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
    </>
  );
}
