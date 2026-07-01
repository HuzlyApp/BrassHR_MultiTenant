"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CandidatesListShell } from "./CandidatesListShell";
import AdvancedSearchModal from "./AdvancedSearchModal";
import { useCandidatesFilterRowsDefault } from "../hooks/useCandidatesFilterRowsDefault";
import { exportCandidatesCsv, exportCandidatesXls } from "../candidates/export-candidates";
import { EditColumnsModal } from "../candidates/EditColumnsModal";
import {
  columnLabel,
  candidateListColumnClassName,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "../candidates/column-config";
import { renderListCell } from "../candidates/render-list-cell";
import { CandidateGridCard } from "../candidates/CandidateGridCard";
import type { CandidateRow } from "../candidates/types";

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
};

type StatusCandidatesPageProps = {
  fetchUrl: string;
  statusLabel: string;
  emptyMessage: string;
};

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "New";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

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

export function StatusCandidatesPage({ fetchUrl, statusLabel, emptyMessage }: StatusCandidatesPageProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [view, setView] = useState<"card" | "list">("list");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadColumnOrder());
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const resolvedUrl = (() => {
        const sep = fetchUrl.includes("?") ? "&" : "?";
        return fetchUrl.includes("includePhotoUrls=")
          ? fetchUrl
          : `${fetchUrl}${sep}includePhotoUrls=1`;
      })();
      const res = await fetch(resolvedUrl, { cache: "no-store" });
      const data = await res.json();
      const authError =
        res.status === 401 ||
        res.status === 403 ||
        String(data?.error ?? "").toLowerCase() === "unauthorized" ||
        String(data?.detail ?? "").toLowerCase().includes("staff role required");
      if (authError) {
        setCandidates([]);
        setTotalFromApi(0);
        setPage(1);
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");

      const rows: WorkerProfile[] = Array.isArray(data?.workers)
        ? data.workers
        : Array.isArray(data)
          ? data
          : [];
      setTotalFromApi(typeof data?.total === "number" ? data.total : rows.length);

      const mapped: CandidateRow[] = rows.map((item) => {
        const { email, phone } = resolveCandidateContact(item);
        return ({
        id: item.id,
        name: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
        firstName: item.first_name ?? "",
        lastName: item.last_name ?? "",
        role: item.job_role || "N/A",
        email,
        phone,
        address: [item.address1, item.city, item.state].filter(Boolean).join(", "),
        city: item.city ?? "",
        state: item.state ?? "",
        zip: item.zip ?? "",
        address1: item.address1 ?? "",
        address2: item.address2 ?? "",
        status: titleCaseStatus(item.status ?? statusLabel),
        createdAt: item.created_at,
        reference: item.id.slice(0, 7).toUpperCase(),
        dateOfBirth: null,
        profilePhotoUrl: item.profile_photo_url ?? null,
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

  const filtered = useMemo(() => {
    let out = candidates;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.reference.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.zip.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q)
        );
      });
    }
    if (jobRoleFilter) out = out.filter((c) => c.role === jobRoleFilter);
    if (locationFilter) {
      out = out.filter((c) => [c.city, c.state].filter(Boolean).join(", ") === locationFilter);
    }
    if (dateFilter) {
      out = out.filter((c) => {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return ymd === dateFilter;
      });
    }
    return out;
  }, [candidates, query, jobRoleFilter, locationFilter, dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, jobRoleFilter, locationFilter, dateFilter, pageSize]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <>
      <CandidatesListShell
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => void loadCandidates()}
        showFilterRows={showFilterRows}
        onToggleFilterRows={() => setShowFilterRows((v) => !v)}
        jobRoleFilter={jobRoleFilter}
        onJobRoleFilterChange={setJobRoleFilter}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        jobRoleOptions={jobRoleOptions}
        locationOptions={locationOptions}
        view={view}
        onViewChange={setView}
        onEditColumns={() => setEditColumnsOpen(true)}
        onExportCsv={() => exportCandidatesCsv(filtered)}
        onExportXls={() => exportCandidatesXls(filtered)}
        onAdvancedSearch={() => setAdvancedSearchOpen(true)}
        totalCount={totalFromApi}
        loading={loading}
        totalLabel={`${statusLabel} applicants`}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        totalFiltered={filtered.length}
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
              <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
                <div className="overflow-auto">
                  <table className="min-w-[820px] w-full border-collapse">
                    <thead className="bg-[#F8FAFC]">
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="w-12 border-r border-[#E5E7EB] bg-[#E5E7EB] px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            aria-label="Select all candidates"
                            className="h-5 w-5 rounded-[5px] border-2 border-[#C8D1DA] accent-[color:var(--brand-primary)]"
                          />
                        </th>
                        {cols.map((colId) => (
                          <th
                            key={colId}
                            className={`border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black last:border-r-0 first:pl-6 last:pr-6 ${candidateListColumnClassName(colId)}`}
                          >
                            {columnLabel(colId)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((c) => (
                        <tr key={c.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                          <td className="w-12 border-r border-[#EEF2F7] px-3 py-4 text-center align-middle">
                            <input
                              type="checkbox"
                              aria-label={`Select ${c.name || "candidate"}`}
                              className="h-5 w-5 rounded-[5px] border-2 border-[#C8D1DA] accent-[color:var(--brand-primary)]"
                            />
                          </td>
                          {cols.map((colId) => (
                            <td
                              key={colId}
                              className={`border-r border-[#EEF2F7] px-4 py-4 align-middle last:border-r-0 first:pl-6 last:pr-6 ${candidateListColumnClassName(colId)}`}
                            >
                              {renderListCell(colId, c, formatDate)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </>
  );
}
