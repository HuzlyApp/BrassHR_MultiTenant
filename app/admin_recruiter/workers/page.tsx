"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { CandidatesPageHeader } from "@/app/admin_recruiter/components/CandidatesPageHeader";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { ListExportDropdown } from "@/app/admin_recruiter/components/ListExportDropdown";
import {
  employmentWorkerTabLabel,
  type EmploymentWorkerTab,
} from "@/lib/admin/employment-workers";
import {
  Columns2,
  Plus,
  Search,
  RefreshCw,
  Filter,
  Loader2,
} from "lucide-react";
import {
  DEFAULT_WORKER_COLUMNS,
  WORKER_COLUMN_OPTIONS,
  loadWorkerColumnOrder,
  saveWorkerColumnOrder,
  workerColumnLabel,
  type WorkerColumnId,
} from "./worker-columns";
import { renderWorkerListCell, type WorkerListRow } from "./render-worker-list-cell";
import { exportWorkersCsv, exportWorkersXls } from "./export-workers";

type EmploymentWorkerRow = {
  id: string;
  candidate_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_role: string | null;
  location: string | null;
  status: string | null;
  worker_type: string | null;
  employment_classification: string | null;
  created_at: string | null;
  profile_photo_url?: string | null;
};

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

function workerTypeLabel(value: string | null | undefined): string {
  const v = (value || "").trim().toLowerCase();
  if (v === "w2") return "W-2";
  if (v === "1099") return "1099";
  return value?.trim() || "";
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

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerListRow[]>([]);
  const [totalFromApi, setTotalFromApi] = useState<number | null>(null);
  const [tabLabel, setTabLabel] = useState("workers");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [workerTab, setWorkerTab] = useState<EmploymentWorkerTab>("all");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [jobRoleFilter, setJobRoleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [listColumnOrder, setListColumnOrder] = useState<WorkerColumnId[]>(DEFAULT_WORKER_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadWorkerColumnOrder());
  }, []);

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

      const mapped: WorkerListRow[] = list.map((w) => {
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
          phone: w.phone?.trim() || "",
          workerType: workerTypeLabel(w.worker_type),
          employmentType: w.employment_classification?.trim() || "",
          reference: (w.candidate_id || w.id).slice(0, 7).toUpperCase(),
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
          className={`flex w-full flex-col gap-0 overflow-visible rounded-t-[8px] border-y border-[#E5E7EB] bg-white ${
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
                onClick={() => setEditColumnsOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <Columns2 className="h-4 w-4 shrink-0" />
                Columns
              </button>
              <ListExportDropdown
                onExportCsv={() => exportWorkersCsv(filtered)}
                onExportXls={() => exportWorkersXls(filtered)}
              />
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
            <div className="flex min-h-[52px] w-full shrink-0 items-center gap-3 px-[14px] py-2">
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
                    className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10`}
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
                    className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10`}
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
                    className={`${CANDIDATES_FILTER_CONTROL_CLASS} relative z-10 min-w-[132px] scheme-light`}
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
            (() => {
              const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_WORKER_COLUMNS;
              return (
                <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
                  <div className="overflow-auto">
                    <table className="min-w-[760px] w-full border-collapse">
                      <thead className="bg-[#F8FAFC]">
                        <tr className="border-b border-[#E5E7EB]">
                          {cols.map((colId) => (
                            <th
                              key={colId}
                              className={`bg-[#E5E7EB] px-4 py-3 text-sm font-medium uppercase tracking-[0.08em] text-black first:pl-6 last:pr-6 ${
                                colId === "name" ? "text-left" : "text-center"
                              } ${colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""}`}
                            >
                              {workerColumnLabel(colId)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((w) => (
                          <tr key={w.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                            {cols.map((colId) => (
                              <td
                                key={colId}
                                className={`px-4 py-4 align-middle first:pl-6 last:pr-6 ${
                                  colId === "name" ? "text-left" : "text-center"
                                } ${colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""}`}
                              >
                                {renderWorkerListCell(colId, w, formatDateShort)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <ColumnsEditorModal
        key={editColumnsOpen ? "worker-cols-open" : "worker-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={WORKER_COLUMN_OPTIONS}
        value={listColumnOrder}
        title="Edit Columns"
        description="Choose which columns appear in the workers list and drag to reorder them."
        onSave={(order) => {
          setListColumnOrder(order);
          saveWorkerColumnOrder(order);
        }}
      />
    </div>
  );
}
