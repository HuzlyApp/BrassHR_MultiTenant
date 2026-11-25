"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import {
  ListPaginationControls,
  ListPaginationShowLabel,
} from "@/app/admin_recruiter/components/ListPaginationControls";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  employmentWorkerStatusLabel,
  type EmploymentWorkerRecord,
} from "@/lib/admin/employment-workers";
import {
  BRAAS_PRIMARY,
  BRAAS_SECONDARY,
  readableTextOnBrand,
} from "@/lib/tenant/tenant-branding";
import { Calendar, Check, ChevronDown, LayoutList, RefreshCw, Search } from "lucide-react";
import { ManagersMetricsCards } from "./ManagersMetricsCards";
import {
  DEFAULT_MANAGER_COLUMNS,
  MANAGER_COLUMN_OPTIONS,
  loadManagerColumnOrder,
  saveManagerColumnOrder,
  managerColumnLabel,
  type ManagerColumnId,
} from "./manager-columns";
import { renderManagerListCell, type ManagerListRow } from "./render-manager-list-cell";

function mapApiWorkerToManagerRow(
  w: Partial<EmploymentWorkerRecord> & { department_id?: string | null }
): ManagerListRow {
  const name = `${w.first_name ?? ""} ${w.last_name ?? ""}`.trim() || "Unnamed Manager";
  const jobRole = (w.job_role || "").trim();
  return {
    id: String(w.id),
    name,
    email: w.email?.trim() || "",
    role: jobRole && jobRole.toLowerCase() !== "manager" ? jobRole : "Manager",
    department: (w.department || "").trim() || "—",
    location: (w.location || "").trim() || "—",
    status: employmentWorkerStatusLabel(w.status),
    createdAt: w.created_at ?? w.converted_at ?? null,
    profilePhotoUrl: w.profile_photo_url ?? null,
    phone: w.phone?.trim() || "—",
    reference: String(w.candidate_id || w.id || "—"),
  };
}

type ManagerTab = "all" | "active" | "inactive";

const MANAGER_TABS: Array<{ id: ManagerTab; label: string }> = [
  { id: "all", label: "All managers" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

const FILTER_CHIP_CLASS =
  "inline-flex h-8 w-full max-w-none cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium leading-4 text-[#334155] transition hover:bg-[#F8FAFC] sm:w-auto sm:justify-start";

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function matchesManagerTab(status: string, tab: ManagerTab): boolean {
  if (tab === "all") return true;
  const normalized = status.trim().toLowerCase();
  if (tab === "active") return normalized === "active";
  return normalized === "inactive" || normalized === "terminated" || normalized === "archived";
}

export default function ManagersPage() {
  const branding = useTenantBranding();
  const primaryColor = branding.primaryHex || BRAAS_PRIMARY;
  const secondaryColor = branding.secondaryHex || BRAAS_SECONDARY || "#012352";
  const textOnPrimary = readableTextOnBrand(primaryColor);

  const [managers, setManagers] = useState<ManagerListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [managerTab, setManagerTab] = useState<ManagerTab>("all");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [departmentMenuOpen, setDepartmentMenuOpen] = useState(false);
  const [listColumnOrder, setListColumnOrder] = useState<ManagerColumnId[]>(DEFAULT_MANAGER_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const loadManagers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        "/api/admin/employment-workers?directoryRole=manager&tab=all",
        { cache: "no-store" }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (payload as { error?: string }).error || "Could not load managers."
        );
      }
      const rows = Array.isArray((payload as { workers?: unknown }).workers)
        ? ((payload as { workers: Partial<EmploymentWorkerRecord>[] }).workers)
        : [];
      setManagers(rows.map(mapApiWorkerToManagerRow));
    } catch (error) {
      setManagers([]);
      setLoadError(error instanceof Error ? error.message : "Could not load managers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setListColumnOrder(loadManagerColumnOrder());
  }, []);

  useEffect(() => {
    void loadManagers();
  }, [loadManagers]);

  useEffect(() => {
    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest?.("[data-filter-dropdown]")) {
        setRoleMenuOpen(false);
        setDepartmentMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  const handleRefresh = () => {
    void loadManagers();
  };

  const handleSearch = () => {
    setAppliedQuery(query);
    setCurrentPage(1);
  };

  const metricsCounts = useMemo(() => {
    let active = 0;
    let inactive = 0;
    for (const m of managers) {
      if (matchesManagerTab(m.status, "active")) active += 1;
      else if (matchesManagerTab(m.status, "inactive")) inactive += 1;
    }
    return { total: managers.length, active, inactive };
  }, [managers]);

  const filtered = useMemo(() => {
    let out = managers.filter((m) => matchesManagerTab(m.status, managerTab));
    const q = appliedQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((m) => {
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q) ||
          m.location.toLowerCase().includes(q)
        );
      });
    }
    if (roleFilter) out = out.filter((m) => m.role === roleFilter);
    if (departmentFilter) out = out.filter((m) => m.department === departmentFilter);
    if (dateFilter) {
      out = out.filter((m) => {
        if (!m.createdAt) return false;
        const d = new Date(m.createdAt);
        if (Number.isNaN(d.getTime())) return false;
        const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return ymd === dateFilter;
      });
    }
    return out;
  }, [managers, appliedQuery, roleFilter, departmentFilter, dateFilter, managerTab]);

  const roleOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of managers) {
      if (m.role && m.role !== "—") s.add(m.role);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [managers]);

  const departmentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const m of managers) {
      if (m.department && m.department !== "—") s.add(m.department);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [managers]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(safeCurrentPage * pageSize, totalItems);
  const paginatedManagers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSize, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [managerTab, roleFilter, departmentFilter, dateFilter, appliedQuery]);

  const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_MANAGER_COLUMNS;

  return (
    <div className="box-border flex w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden px-4 pb-8 pt-[30px] sm:px-5 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-7 text-black">Managers</h1>
        <p className="text-xs leading-4 text-[#374151]">
          People promoted from Workers appear here
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      <div className="flex items-center gap-6 overflow-x-auto border-b border-[#E5E7EB] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {MANAGER_TABS.map((tab) => {
          const active = managerTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setManagerTab(tab.id)}
              className={`shrink-0 cursor-pointer whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                active
                  ? "border-[color:var(--brand-primary)] text-[color:var(--brand-primary)]"
                  : "border-transparent text-[#667085] hover:text-[color:var(--brand-primary)]"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <ManagersMetricsCards counts={metricsCounts} loading={loading} />

      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="flex w-full max-w-[480px] flex-col gap-2 rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-2xs sm:flex-row sm:items-center sm:gap-0 sm:p-1">
            <div className="relative flex min-w-0 flex-1 items-center pl-3">
              <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Search managers"
                className="w-full min-w-0 bg-transparent px-3 py-1.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleSearch}
              style={{ backgroundColor: primaryColor, color: textOnPrimary }}
              className="h-9 w-full shrink-0 cursor-pointer rounded-lg px-4 text-xs font-semibold leading-4 shadow-xs transition hover:brightness-95 active:scale-[0.98] sm:h-8 sm:w-auto"
            >
              Search
            </button>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
            <div className="relative min-w-0" data-filter-dropdown>
              <button
                type="button"
                onClick={() => {
                  setRoleMenuOpen(!roleMenuOpen);
                  setDepartmentMenuOpen(false);
                }}
                className={`${FILTER_CHIP_CLASS} sm:max-w-[220px]`}
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
              >
                <span className="truncate">Role • {roleFilter || "All"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
              </button>
              {roleMenuOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-60">
                  {["All", ...roleOptions].map((opt) => {
                    const isAll = opt === "All";
                    const isSelected = roleFilter ? roleFilter === opt : isAll;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setRoleFilter(isAll ? "" : opt);
                          setRoleMenuOpen(false);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC]"
                      >
                        <span className="truncate pr-2">{opt}</span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="relative min-w-0" data-filter-dropdown>
              <button
                type="button"
                onClick={() => {
                  setDepartmentMenuOpen(!departmentMenuOpen);
                  setRoleMenuOpen(false);
                }}
                className={`${FILTER_CHIP_CLASS} sm:max-w-[200px]`}
                aria-haspopup="listbox"
                aria-expanded={departmentMenuOpen}
              >
                <span className="truncate">Department • {departmentFilter || "All"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B]" />
              </button>
              {departmentMenuOpen && (
                <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white py-1 shadow-lg sm:left-auto sm:right-0 sm:w-52">
                  {["All", ...departmentOptions].map((opt) => {
                    const isAll = opt === "All";
                    const isSelected = departmentFilter ? departmentFilter === opt : isAll;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setDepartmentFilter(isAll ? "" : opt);
                          setDepartmentMenuOpen(false);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-xs text-[#334155] hover:bg-[#F8FAFC]"
                      >
                        <span className="truncate pr-2">{opt}</span>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <label className="relative col-span-2 min-w-0 sm:col-span-1">
              <span className="sr-only">Created Date</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`${FILTER_CHIP_CLASS} scheme-light pr-9 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
              />
              <Calendar
                className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"
                aria-hidden
              />
            </label>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditColumnsOpen(true)}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] shadow-2xs transition hover:bg-[#F8FAFC]"
            title="Edit Columns"
          >
            <LayoutList className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] shadow-2xs transition hover:bg-[#F8FAFC]"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xs">
        <div className="-mx-px overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
          <table
            aria-busy={loading}
            className="w-full min-w-[760px] border-collapse text-left text-sm xl:min-w-full"
          >
            <thead className="border-b border-[#E2E8F0] bg-white">
              <tr>
                {cols.map((colId) => (
                  <th
                    key={colId}
                    className={`px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-[#475569] whitespace-nowrap ${
                      colId === "profile" ? "text-right pr-4" : ""
                    } ${colId === "createdDate" ? "min-w-[140px]" : ""}`}
                  >
                    {managerColumnLabel(colId)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-8">
                    <div role="status" aria-label="Loading managers" className="space-y-4">
                      {Array.from({ length: 5 }, (_, index) => (
                        <div key={index} className="h-8 animate-pulse rounded bg-slate-200" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : paginatedManagers.length === 0 ? (
                <tr>
                  <td
                    colSpan={cols.length}
                    className="py-16 text-center text-sm text-[#64748B]"
                  >
                    No managers found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedManagers.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-[#F8FAFC]">
                    {cols.map((colId) => (
                      <td
                        key={colId}
                        className={`px-3.5 py-3.5 align-middle whitespace-nowrap ${
                          colId === "profile" ? "text-right pr-4" : ""
                        } ${colId === "createdDate" ? "min-w-[140px]" : ""}`}
                      >
                        {renderManagerListCell(colId, m, formatDateShort)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 rounded-b-xl border-t border-[#E5E7EB] bg-white px-3 py-3.5 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:justify-start">
            <p className="min-w-0 text-xs font-medium text-[#64748B]">
              Showing{" "}
              <span className="font-semibold text-[#0F172A]">
                {totalItems === 0 ? "0" : `${pageStart}–${pageEnd}`}
              </span>{" "}
              of <span className="font-semibold text-[#0F172A]">{totalItems}</span> results
            </p>
            <div className="shrink-0 lg:hidden">
              <ListPaginationShowLabel
                pageSize={pageSize}
                options={[10, 25, 50, 100]}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <div className="hidden shrink-0 lg:block">
              <ListPaginationShowLabel
                pageSize={pageSize}
                options={[10, 25, 50, 100]}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex w-full min-w-0 justify-center overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] sm:w-auto sm:justify-end sm:overflow-visible">
              <ListPaginationControls
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                activeStyle={{
                  backgroundColor: secondaryColor,
                  borderColor: secondaryColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <ColumnsEditorModal
        key={editColumnsOpen ? "manager-cols-open" : "manager-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={MANAGER_COLUMN_OPTIONS}
        value={listColumnOrder}
        defaultValue={DEFAULT_MANAGER_COLUMNS}
        title="Edit Columns"
        description="Choose which columns appear in the managers list and drag to reorder them."
        onSave={(order) => {
          setListColumnOrder(order);
          saveManagerColumnOrder(order);
        }}
      />
    </div>
  );
}
