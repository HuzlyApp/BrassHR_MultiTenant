"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import {
  candidateMailHref,
  candidateProfileHref,
} from "@/app/admin_recruiter/candidates/candidate-links";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { CandidatesPageHeader } from "@/app/admin_recruiter/components/CandidatesPageHeader";
import { candidateStatusBadgeClassName } from "@/app/admin_recruiter/candidates/candidate-status-badge";
import {
  employmentWorkerTabLabel,
  type EmploymentWorkerTab,
} from "@/lib/admin/employment-workers";
import {
  Plus,
  Search,
  RefreshCw,
  Filter,
  Loader2,
} from "lucide-react";

type EmploymentWorkerRow = {
  id: string;
  candidate_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
  location: string | null;
  status: string | null;
  created_at: string | null;
  profile_photo_url?: string | null;
};

const LINK_CLASS =
  "truncate text-left transition hover:text-[color:var(--brand-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]";

const WORKER_TABS: Array<{ id: EmploymentWorkerTab; label: string }> = [
  { id: "new", label: "New only" },
  { id: "all", label: "All workers" },
  { id: "w2", label: "W-2" },
  { id: "1099", label: "1099" },
];

function titleCaseStatus(s: string | null | undefined) {
  const v = (s || "").trim();
  if (!v) return "—";
  const low = v.toLowerCase();
  return low.slice(0, 1).toUpperCase() + low.slice(1);
}

export default function WorkersPage() {
  const [workers, setWorkers] = useState<
    Array<{
      id: string;
      profileId: string;
      name: string;
      email: string;
      role: string;
      location: string;
      status: string;
      createdAt: string | null;
      profilePhotoUrl: string | null;
    }>
  >([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [tabLabel, setTabLabel] = useState("workers");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [workerTab, setWorkerTab] = useState<EmploymentWorkerTab>("all");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employment-workers?tab=${workerTab}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const authError =
        res.status === 401 ||
        res.status === 403 ||
        String(data?.error ?? "").toLowerCase() === "unauthorized" ||
        String(data?.detail ?? "").toLowerCase().includes("staff role required");
      if (authError) {
        setWorkers([]);
        setTotalFromApi(0);
        setTabLabel(employmentWorkerTabLabel(workerTab));
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers");

      const list: EmploymentWorkerRow[] = Array.isArray(data?.workers) ? data.workers : [];
      setTotalFromApi(typeof data?.total === "number" ? data.total : list.length);
      setTabLabel(
        typeof data?.tabLabel === "string" ? data.tabLabel : employmentWorkerTabLabel(workerTab)
      );

      const mapped = list.map((w) => {
        const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed";
        return {
          id: w.id,
          profileId: w.candidate_id,
          name,
          email: w.email?.trim() || "",
          role: w.job_role || "—",
          location: w.location?.trim() || "—",
          status: titleCaseStatus(w.status),
          createdAt: w.created_at ?? null,
          profilePhotoUrl: w.profile_photo_url ?? null,
        };
      });
      setWorkers(mapped);
    } catch (err) {
      console.error("Failed to fetch workers:", err);
      setWorkers([]);
      setTotalFromApi(null);
      setTabLabel(employmentWorkerTabLabel(workerTab));
    } finally {
      setLoading(false);
    }
  }, [workerTab]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const filtered = useMemo(() => {
    let out = workers;
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
        );
      });
    }
    if (jobRoleFilter) out = out.filter((c) => c.role === jobRoleFilter);
    if (locationFilter) out = out.filter((c) => c.location === locationFilter);
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
  }, [workers, query, jobRoleFilter, locationFilter, dateFilter]);

  const jobRoleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const w of workers) {
      if (w.role && w.role !== "—") s.add(w.role);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [workers]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const w of workers) {
      if (w.location && w.location !== "—") s.add(w.location);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [workers]);

  function workerTabClass(active: boolean): string {
    return active
      ? "border-b-2 border-(--brand-primary) pb-3 text-(--brand-primary)"
      : "border-b-2 border-transparent pb-3 text-[#667085] transition-colors hover:text-(--brand-primary)";
  }

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <div className="mb-4 flex items-center gap-6 border-b border-[#E5E7EB]">
        {WORKER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setWorkerTab(tab.id)}
            className={`shrink-0 whitespace-nowrap text-sm font-medium ${workerTabClass(workerTab === tab.id)}`}
            aria-current={workerTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <CandidatesPageHeader title="Workers" subtitle="Manage workers in one place" />

        <div
          className={`flex w-full flex-col gap-0 overflow-hidden rounded-t-[8px] border-y border-[#E5E7EB] bg-white ${
            showFilterRows ? "min-h-[104px]" : "min-h-[52px]"
          }`}
        >
          <div className="flex h-[52px] w-full shrink-0 items-center gap-3 border-b border-[#E5E7EB] px-[14px]">
            <div className="flex h-8 w-full min-w-0 max-w-[360px] items-center rounded-md border border-[#dce6e3] bg-white px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-[#94A3B8]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search workers"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-6 text-[#334155] outline-none placeholder:text-[#94A3B8]"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Filter className="h-4 w-4 shrink-0" />
                Filters
              </button>
              <button
                type="button"
                onClick={() => void loadWorkers()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Plus className="h-4 w-4 shrink-0" />
                Create Worker
              </button>
            </div>
          </div>

          {showFilterRows ? (
            <div className="flex h-[52px] w-full shrink-0 items-center gap-3 px-[14px]">
              <div className="flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <BrandedSvgIcon
                  src="/icons/admin-recruiter/candidates/filtered.svg.svg"
                  className="h-4 w-4 shrink-0"
                  color="var(--brand-primary)"
                />
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Job Role
                  </span>
                  <select
                    value={jobRoleFilter}
                    onChange={(e) => setJobRoleFilter(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {jobRoleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Location
                  </span>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {locationOptions.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Date Applied
                  </span>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className={`${CANDIDATES_FILTER_CONTROL_CLASS} min-w-[132px] scheme-light`}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex w-full items-center gap-3 px-[14px] py-3">
          <div className="text-xs leading-4 text-[#5e7371]">
            Total: <span className="font-semibold text-[#203130]">{loading ? "—" : totalFromApi ?? workers.length}</span> {tabLabel}
          </div>
        </div>

        <div className="bg-white px-[14px] py-4">
          {loading ? null : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-600">No workers found.</div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
              <div className="overflow-auto">
                <table className="min-w-[760px] w-full border-collapse">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Name
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Job Role
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Location
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Status
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-right text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Profile
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => (
                      <tr key={w.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                        <td className="px-4 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <CandidateListAvatar
                              name={w.name || "NA"}
                              photoUrl={w.profilePhotoUrl}
                            />
                            <div className="min-w-0">
                              <Link
                                href={candidateProfileHref(w.profileId)}
                                className={`block text-sm font-medium text-black ${LINK_CLASS}`}
                              >
                                {w.name}
                              </Link>
                              {w.email ? (
                                <Link
                                  href={candidateMailHref(w.profileId)}
                                  className={`block text-xs text-[#4B5563] ${LINK_CLASS}`}
                                >
                                  {w.email}
                                </Link>
                              ) : (
                                <div className="truncate text-xs text-[#4B5563]">—</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{w.role}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{w.location}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold ${candidateStatusBadgeClassName(w.status)}`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={candidateProfileHref(w.profileId)}
                            className="inline-flex items-center gap-1 rounded-full bg-(--brand-primary) px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95"
                          >
                            Open <span aria-hidden>-&gt;</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
