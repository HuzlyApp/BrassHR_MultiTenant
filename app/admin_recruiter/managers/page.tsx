"use client";

import { useEffect, useMemo, useState } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { CandidatesPageHeader } from "@/app/admin_recruiter/components/CandidatesPageHeader";
import { ColumnsEditorModal } from "@/app/admin_recruiter/components/ColumnsEditorModal";
import { Columns2, Plus, Search, RefreshCw, Filter } from "lucide-react";
import {
  DEFAULT_MANAGER_COLUMNS,
  MANAGER_COLUMN_OPTIONS,
  loadManagerColumnOrder,
  saveManagerColumnOrder,
  managerColumnLabel,
  type ManagerColumnId,
} from "./manager-columns";
import { renderManagerListCell, type ManagerListRow } from "./render-manager-list-cell";

type ManagerTab = "all" | "active" | "inactive";

const MANAGER_TABS: Array<{ id: ManagerTab; label: string }> = [
  { id: "all", label: "All managers" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

function managerTabLabel(tab: ManagerTab): string {
  switch (tab) {
    case "active":
      return "active managers";
    case "inactive":
      return "inactive managers";
    default:
      return "managers";
  }
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

export default function ManagersPage() {
  const [managers] = useState<ManagerListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [managerTab, setManagerTab] = useState<ManagerTab>("all");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [listColumnOrder, setListColumnOrder] = useState<ManagerColumnId[]>(DEFAULT_MANAGER_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadManagerColumnOrder());
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 400);
  };

  const filtered = useMemo(() => {
    let out = managers;
    const q = query.trim().toLowerCase();
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
  }, [managers, query, roleFilter, departmentFilter, dateFilter]);

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

  function managerTabClass(active: boolean): string {
    return active
      ? "border-b-2 border-(--brand-primary) pb-3 text-(--brand-primary)"
      : "border-b-2 border-transparent pb-3 text-[#667085] transition-colors hover:text-(--brand-primary)";
  }

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <div className="mb-4 flex items-center gap-6 border-b border-[#E5E7EB]">
        {MANAGER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setManagerTab(tab.id)}
            className={`shrink-0 whitespace-nowrap text-sm font-medium ${managerTabClass(managerTab === tab.id)}`}
            aria-current={managerTab === tab.id ? "page" : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <CandidatesPageHeader title="Managers" subtitle="Manage managers in one place" />

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
                placeholder="Search managers"
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
              <button
                type="button"
                onClick={handleRefresh}
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
                Create Manager
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
                    Role
                  </span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Department
                  </span>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    {departmentOptions.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Created Date
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
            Total: <span className="font-semibold text-[#203130]">{loading ? "—" : filtered.length}</span> {managerTabLabel(managerTab)}
          </div>
        </div>

        <div className="bg-white px-[14px] py-4">
          {loading ? null : filtered.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center py-16 text-center">
              <p className="text-base font-medium text-[#475569]">No data found</p>
            </div>
          ) : (
            (() => {
              const cols = listColumnOrder.length ? listColumnOrder : DEFAULT_MANAGER_COLUMNS;
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
                              {managerColumnLabel(colId)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((m) => (
                          <tr key={m.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                            {cols.map((colId) => (
                              <td
                                key={colId}
                                className={`px-4 py-4 align-middle first:pl-6 last:pr-6 ${
                                  colId === "name" ? "text-left" : "text-center"
                                } ${colId === "createdDate" ? "min-w-[140px] whitespace-nowrap" : ""}`}
                              >
                                {renderManagerListCell(colId, m, formatDateShort)}
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
        key={editColumnsOpen ? "manager-cols-open" : "manager-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        options={MANAGER_COLUMN_OPTIONS}
        value={listColumnOrder}
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
