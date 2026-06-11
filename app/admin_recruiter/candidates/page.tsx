// app/admin_recruiter/candidates/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { Loader2, MessageCircle } from "lucide-react";
import { EditColumnsModal } from "./EditColumnsModal";
import {
  columnLabel,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "./column-config";
import { renderListCell } from "./render-list-cell";
import type { CandidateRow } from "./types";
import AdvancedSearchModal from "../components/AdvancedSearchModal";
import CandidateCommunicationDialog from "../components/CandidateCommunicationDialog";
import { CandidatesListShell } from "../components/CandidatesListShell";
import { exportCandidatesCsv } from "./export-candidates-csv";
import { candidateStatusBadgeClassName } from "./candidate-status-badge";

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
};

const BRAND_AVATAR_GRADIENT =
  "linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)";
const BRAND_ICON = "var(--brand-primary)";

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "New";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

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

export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [view, setView] = useState<"card" | "list">("card");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [advancedSearchParams, setAdvancedSearchParams] = useState<AdvancedSearchParams | null>(null);
  const [commTarget, setCommTarget] = useState<CandidateRow | null>(null);

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
          email,
          phone,
          address: [item.address1, item.city, item.state].filter(Boolean).join(", "),
          city: item.city ?? "",
          state: item.state ?? "",
          zip: item.zip ?? "",
          address1: item.address1 ?? "",
          address2: item.address2 ?? "",
          status: titleCaseStatus(item.status as string | undefined),
          createdAt: item.created_at,
          reference: item.id.slice(0, 7).toUpperCase(),
          dateOfBirth: null,
          });
        });

        setCandidates(mapped);
        setPage(1);
        return;
      }

      const res = await fetch("/api/workers", { cache: "no-store" });
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
        status: titleCaseStatus(item.status as string | undefined),
        createdAt: item.created_at,
        reference: item.id.slice(0, 7).toUpperCase(),
        dateOfBirth: null,
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
        onRefresh={() => {
          if (advancedSearchContext.active) {
            applyAdvancedSearchParams(null);
            void loadCandidates(null);
            return;
          }
          void loadCandidates();
        }}
        refreshLabel={advancedSearchContext.active ? "Reset Search" : "Refresh"}
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
        onExport={() => exportCandidatesCsv(filtered)}
        onAdvancedSearch={() => setAdvancedSearchOpen(true)}
        totalCount={totalFromApi}
        loading={loading}
        totalLabel="applicants"
        advancedSearchActive={advancedSearchContext.active}
        advancedSearchPlace={advancedSearchContext.place}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        totalFiltered={filtered.length}
      >
        {(() => {
          const formatDate = formatDateShort;

          if (loading) {
            return (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-600">
                <Loader2 className="h-8 w-8 animate-spin text-[color:var(--brand-primary)]" />
                Loading candidates…
              </div>
            );
          }
          if (filtered.length === 0) {
            return (
              <div className="py-24 text-center text-gray-600">
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
              <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
                <div className="overflow-auto">
                  <table className="min-w-[760px] w-full border-collapse">
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
                            className={`border-r border-[#E5E7EB] bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black last:border-r-0 first:pl-6 last:pr-6 ${
                              colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""
                            }`}
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
                              className={`border-r border-[#EEF2F7] px-4 py-4 align-middle last:border-r-0 first:pl-6 last:pr-6 ${
                                colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""
                              }`}
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
                        <div
                          key={c.id}
                          className="bg-white border border-[#e3ecea] rounded-lg p-3.5 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                                style={{ background: BRAND_AVATAR_GRADIENT }}
                              >
                                {initialsFromName(c.name || "NA")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-normal text-black truncate text-sm">{c.name || "Unnamed"}</div>
                                <div className="text-[10px] text-[#6B7280] mt-0.5">RN #{c.reference}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setCommTarget(c)}
                                disabled={!c.email?.trim() && !c.phone?.trim()}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)] disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Message candidate"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                              <Link
                                href={`/admin_recruiter/new/attachments/${c.id}`}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                                aria-label="View document"
                              >
                               <BrandedSvgIcon src="/icons/admin-recruiter/save.svg" className="h-4 w-4" color={BRAND_ICON} />
                              
                              </Link>
                              <Link
                                href={`/admin_recruiter/new/profile/${c.id}`}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[#4e6462] transition hover:bg-[color:color-mix(in_srgb,var(--brand-primary)_8%,white)]"
                                aria-label="View profile"
                              >
                                <BrandedSvgIcon src="/icons/admin-recruiter/eye.svg" className="h-4 w-4" color={BRAND_ICON} />
                              </Link>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center border-b border-[#E5E7EB] pb-3 justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#6f8380]">
                            <BrandedSvgIcon src="/icons/admin-recruiter/calendar.svg" className="h-4 w-4" color={BRAND_ICON} />
                              <span>{formatDateTime(c.createdAt)}</span>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-xl text-[10px] font-semibold ${candidateStatusBadgeClassName(c.status)}`}
                            >
                              {c.status}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 text-[11px] text-[#4f6462]">
                            <div className="flex items-start gap-2.5">
                            <BrandedSvgIcon src="/icons/admin-recruiter/alternate_email.svg" className="h-4 w-4" color={BRAND_ICON} />
                              <span className="truncate text-black">{c.email || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                            <BrandedSvgIcon src="/icons/admin-recruiter/phone.svg" className="h-4 w-4" color={BRAND_ICON} />
                              <span className="truncate text-black">{c.phone || "—"}</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                            <BrandedSvgIcon src="/icons/admin-recruiter/location-marker.svg" className="h-4 w-4" color={BRAND_ICON} />
                              <span className="leading-snug text-black">{c.address || "—"}</span>
                            </div>
                          </div>
                        </div>
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
    </>
  );
}
