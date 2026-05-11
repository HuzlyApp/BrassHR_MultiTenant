"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Columns2, Loader2, Bell, MessageCircle } from "lucide-react";
import { EditColumnsModal } from "../candidates/EditColumnsModal";
import {
  columnLabel,
  DEFAULT_CANDIDATE_COLUMNS,
  loadColumnOrder,
  saveColumnOrder,
  type CandidateColumnId,
} from "../candidates/column-config";
import { renderListCell } from "../candidates/render-list-cell";
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

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
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

const PAGE_SIZE = 9;

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
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter] = useState("Candidates");
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [view, setView] = useState<"card" | "list">("card");
  const [listColumnOrder, setListColumnOrder] = useState<CandidateColumnId[]>(DEFAULT_CANDIDATE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadColumnOrder());
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(fetchUrl, { cache: "no-store" });
      const data = await res.json();
      const authError =
        res.status === 401 ||
        res.status === 403 ||
        String(data?.error ?? "").toLowerCase() === "unauthorized" ||
        String(data?.detail ?? "").toLowerCase().includes("staff role required");
      if (authError) {
        setCandidates([]);
        setTotalFromApi(0);
        setVisibleCount(PAGE_SIZE);
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
        });
      });

      setCandidates(mapped);
      setVisibleCount(PAGE_SIZE);
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
    return out;
  }, [candidates, query, jobRoleFilter, locationFilter]);

  const visibleCards = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  return (
    <div className="flex h-screen bg-[#f3f5f5] overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-30 h-16 border-b border-[#e5ecea] bg-white flex items-center px-6 justify-between shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[#9da9a6]">
              <button type="button" className="p-1.5 rounded-lg hover:bg-zinc-100" aria-label="Messages">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button type="button" className="p-1.5 rounded-lg hover:bg-zinc-100" aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block leading-tight">
                <div className="font-semibold text-sm text-[#2d3a39]">Sean Smith</div>
                <div className="text-[10px] text-[#8ca09e]">Manager</div>
              </div>
              <img
                src="https://i.pravatar.cc/128?u=sean"
                alt="Sean Smith"
                className="w-8 h-8 rounded-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-5 overflow-hidden flex flex-col">
          <div className="flex flex-col gap-2 mb-4">
            <div>
              <h1 className="text-[36px] font-semibold leading-10 tracking-normal text-[#1d2739]">
                Candidates
              </h1>
              <p className="mt-1 text-sm text-[#6f7683]">Manage applicants in one place</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="relative z-10 w-full shrink-0 rounded-md border border-[#E5E7EB] bg-white overflow-hidden flex flex-col">
              <div className="min-h-[60px] border-b border-[#E5E7EB] p-[14px] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="h-8 inline-flex items-center gap-1.5 bg-[#0c918a] hover:bg-[#0a7b75] text-white px-3 rounded-md transition text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Candidate
                </button>

                <div className="flex flex-1 items-center gap-2 flex-wrap justify-start sm:justify-end">
                  <div className="flex h-8 items-center bg-white border border-[#dce6e3] rounded-md px-3 w-full min-w-[180px] sm:w-auto sm:min-w-[220px]">
                    <Image src="/icons/admin-recruiter/candidates/search.svg" alt="" width={16} height={16} className="mr-2 shrink-0" />
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search worker or candidate"
                      className="bg-transparent outline-none flex-1 min-w-0 text-xs leading-4 font-normal text-[#94A3B8] placeholder:text-[#94A3B8]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadCandidates()}
                    className="h-8 inline-flex items-center gap-1.5 border border-[#dce6e3] bg-white hover:bg-zinc-50 px-3 rounded-md transition text-xs leading-4 font-semibold text-[#3d4a4a]"
                  >
                    <Image src="/icons/admin-recruiter/candidates/refresh.svg" alt="" width={16} height={16} />
                    Refresh
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFilterRows((v) => !v)}
                    className="h-8 inline-flex items-center gap-1.5 border border-[#dce6e3] bg-white hover:bg-zinc-50 px-3 rounded-md transition text-xs leading-4 font-semibold text-[#3d4a4a]"
                  >
                    <Image src="/icons/admin-recruiter/candidates/filter.svg" alt="" width={16} height={16} />
                    {showFilterRows ? "Hide View" : "View Filters"}
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen((v) => !v)}
                      className="flex items-center justify-center w-8 h-8 border border-[#dce6e3] bg-white hover:bg-zinc-50 rounded-md transition"
                      aria-label="More actions"
                    >
                      <Image src="/icons/admin-recruiter/candidates/three-dot.svg" alt="" width={16} height={16} />
                    </button>
                    {moreMenuOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-40 cursor-default"
                          aria-label="Close menu"
                          onClick={() => setMoreMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-2xl border border-zinc-200 bg-white py-2 shadow-lg">
                          <Link
                            href="/admin_recruiter/advanced-search"
                            className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-zinc-50"
                            onClick={() => setMoreMenuOpen(false)}
                          >
                            Advanced search
                          </Link>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {showFilterRows ? (
                <>
                  <div className="min-h-[60px] border-b border-[#E5E7EB] p-[14px] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex w-full items-start gap-3">
                      <div className="flex items-center pt-1 text-[#9aaba9]">
                        <Image src="/icons/admin-recruiter/candidates/filtered.svg.svg" alt="" width={20} height={20} />
                      </div>
                      <div className="grid flex-1 min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#6f8380] whitespace-nowrap">Type</span>
                        <select
                          value={typeFilter}
                          disabled
                          className="h-8 w-full min-w-0 text-xs px-2 rounded-md border border-[#dce6e3] bg-white text-[#435351] focus:outline-none focus:ring-0 focus:border-[#dce6e3]"
                        >
                          <option>Candidates</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#6f8380] whitespace-nowrap">Status</span>
                        <select
                          value={statusLabel}
                          disabled
                          className="h-8 w-full min-w-0 text-xs px-2 rounded-md border border-[#dce6e3] bg-white text-[#435351] focus:outline-none focus:ring-0 focus:border-[#dce6e3]"
                        >
                          <option>{statusLabel}</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#6f8380] whitespace-nowrap">Job Role</span>
                        <select
                          value={jobRoleFilter}
                          onChange={(e) => setJobRoleFilter(e.target.value)}
                          className="h-8 w-full min-w-0 text-xs px-2 rounded-md border border-[#dce6e3] bg-white hover:bg-zinc-50 focus:outline-none focus:ring-0 focus:border-[#dce6e3]"
                        >
                          <option value="">All</option>
                          {jobRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-[#6f8380] whitespace-nowrap">Location</span>
                        <select
                          value={locationFilter}
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="h-8 w-full min-w-0 text-xs px-2 rounded-md border border-[#dce6e3] bg-white hover:bg-zinc-50 focus:outline-none focus:ring-0 focus:border-[#dce6e3]"
                        >
                          <option value="">All</option>
                          {locationOptions.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </label>
                      </div>
                    </div>
                  </div>

                  <div className="h-[56px] border-b border-[#E5E7EB] bg-white px-[14px] flex items-center justify-between gap-4">
                    <div className="text-xs text-[#5e7371] shrink-0">
                      Total:{" "}
                      <span className="font-semibold text-[#203130]">{loading ? "—" : totalFromApi ?? filtered.length}</span>{" "}
                      {loading ? "" : `${statusLabel} applicants`}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-medium ${view === "card" ? "text-[#0f6a65]" : "text-[#6f8380]"}`}>
                        Card View
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={view === "list"}
                        aria-label="Toggle list view"
                        onClick={() => setView((v) => (v === "card" ? "list" : "card"))}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          view === "list" ? "bg-[#0c918a]" : "bg-zinc-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                            view === "list" ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      <span className={`text-[11px] font-medium ${view === "list" ? "text-[#0f6a65]" : "text-[#6f8380]"}`}>
                        List View
                      </span>
                      {view === "list" ? (
                        <button
                          type="button"
                          onClick={() => setEditColumnsOpen(true)}
                          className="inline-flex items-center gap-2 rounded-md border border-[#dce6e3] bg-white px-3 py-1.5 text-[11px] font-medium text-[#506462] hover:bg-zinc-50"
                        >
                          <Columns2 className="h-4 w-4" />
                          Edit columns
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="relative z-0 flex-1 min-h-0 px-0 pb-4 pt-6 overflow-auto bg-[#f3f5f5] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(() => {
                const formatDate = formatDateShort;

                if (loading) {
                  return (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                      Loading candidates…
                    </div>
                  );
                }
                if (filtered.length === 0) {
                  return <div className="text-center py-24 text-gray-600">{emptyMessage}</div>;
                }

                if (view === "list") {
                  const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_CANDIDATE_COLUMNS;
                  return (
                    <div className="mx-4 overflow-hidden rounded-xl border border-[#D9DEE5] bg-white">
                      <div className="overflow-auto">
                        <table className="min-w-[760px] w-full border-collapse">
                          <thead className="bg-[#F8FAFC]">
                            <tr className="border-b border-[#E5E7EB]">
                              <th className="w-12 bg-[#E5E7EB] px-3 py-3 text-center border-r border-[#E5E7EB]">
                                <input
                                  type="checkbox"
                                  aria-label="Select all candidates"
                                  className="h-5 w-5 rounded-[5px] border-2 border-[#C8D1DA] accent-[#0C9A92]"
                                />
                              </th>
                              {cols.map((colId) => (
                                <th
                                  key={colId}
                                  className={`px-4 py-3 bg-[#E5E7EB] text-left text-sm font-medium uppercase tracking-[0.08em] text-black first:pl-6 last:pr-6 border-r border-[#E5E7EB] last:border-r-0 ${
                                    colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""
                                  }`}
                                >
                                  {columnLabel(colId)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((c) => (
                              <tr key={c.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                                <td className="w-12 px-3 py-4 text-center border-r border-[#EEF2F7] align-middle">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${c.name || "candidate"}`}
                                    className="h-5 w-5 rounded-[5px] border-2 border-[#C8D1DA] accent-[#0C9A92]"
                                  />
                                </td>
                                {cols.map((colId) => (
                                  <td
                                    key={colId}
                                    className={`px-4 py-4 first:pl-6 last:pr-6 align-middle border-r border-[#EEF2F7] last:border-r-0 ${
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
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {visibleCards.map((c) => (
                        <div
                          key={c.id}
                          className="bg-white border border-[#e3ecea] rounded-lg p-3.5 hover:shadow-sm transition-shadow"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#27c8c0_0%,#16877f_100%)] text-white text-sm font-semibold text-white flex items-center justify-center font-semibold shrink-0">
                                {initialsFromName(c.name || "NA")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-normal text-black truncate text-sm">{c.name || "Unnamed"}</div>
                                <div className="text-[10px] text-[#6B7280] mt-0.5">RN #{c.reference}</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Link
                                href={`/admin_recruiter/new/attachments/${c.id}`}
                                className="w-6 h-6 rounded-md hover:bg-teal-50 flex items-center justify-center text-[#4e6462] transition"
                                aria-label="View document"
                              >
                                <img src="/icons/admin-recruiter/save.svg" alt="Save" className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/admin_recruiter/new/profile/${c.id}`}
                                className="w-6 h-6 rounded-md hover:bg-teal-50 flex items-center justify-center text-[#4e6462] transition"
                                aria-label="View profile"
                              >
                                <img src="/icons/admin-recruiter/eye.svg" alt="View" className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center border-b border-[#E5E7EB] pb-3 justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-[11px] text-[#6f8380]">
                              <img src="/icons/admin-recruiter/calendar.svg" alt="Calendar" className="h-4 w-4" />
                              <span>{formatDateTime(c.createdAt)}</span>
                            </div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-semibold border border-[#0D9488] text-[#0D9488] ">
                              {c.status}
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5 text-[11px] text-[#4f6462]">
                            <div className="flex items-start gap-2.5">
                              <img src="/icons/admin-recruiter/alternate_email.svg" alt="Email" className="h-4 w-4" />
                              <span className="truncate text-black">{c.email || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <img src="/icons/admin-recruiter/phone.svg" alt="Phone" className="h-4 w-4" />
                              <span className="truncate text-black">{c.phone || "—"}</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <img src="/icons/admin-recruiter/location-marker.svg" alt="Location" className="h-4 w-4" />
                              <span className="leading-snug text-black">{c.address || "—"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {visibleCount < filtered.length ? (
                      <div className="flex justify-center mt-8 pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setLoadMoreLoading(true);
                            setTimeout(() => {
                              setVisibleCount((n) => n + PAGE_SIZE);
                              setLoadMoreLoading(false);
                            }, 400);
                          }}
                          disabled={loadMoreLoading}
                          className="inline-flex items-center gap-2 px-2 py-1 text-sm font-semibold text-[#6B7280] hover:text-[#4B5563] transition disabled:opacity-70"
                        >
                          Load more
                          <Loader2 className={`w-4 h-4 text-[#3B82F6] ${loadMoreLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
