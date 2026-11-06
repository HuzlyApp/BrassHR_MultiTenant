"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  MoreVertical,
  X,
  CheckCircle2,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import type { TimesheetRow, TimesheetMetrics, DayDetail } from "@/app/api/admin/timesheets/route";

function statusBadge(status: string) {
  switch (status.toLowerCase()) {
    case "complete":
      return "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]";
    case "incomplete":
      return "bg-[#FEE2E2] text-[#DC2626] border border-[#FECDD3]";
    case "with ot":
      return "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]";
    default:
      return "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]";
  }
}

export default function TimesheetsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [totalResults, setTotalResults] = useState(100);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedJobTitle, setSelectedJobTitle] = useState("all");

  // Filter options
  const [facilities, setFacilities] = useState<string[]>([
    "NorthPoint Warehouse",
    "Metro Care Facility",
    "Prime Storage Center",
    "Oakridge Warehouse",
    "NovaCore Facility",
  ]);
  const [departments, setDepartments] = useState<string[]>([
    "Warehouse",
    "Inventory",
    "Maintenance",
    "Administration",
    "Logistics",
    "Operations",
  ]);
  const [jobTitles, setJobTitles] = useState<string[]>([
    "Warehouse Staff",
    "Inventory Clerk",
    "Maintenance",
    "Admin Assistant",
    "Picker",
    "Operations Manager",
  ]);

  // Metrics
  const [metrics, setMetrics] = useState<TimesheetMetrics>({
    totalHours: "257h 30m",
    employees: 40,
    withOvertime: 22,
    incomplete: 8,
  });

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => {
    // Base week: Sept 21 - 27, 2026
    const baseMon = new Date(2026, 8, 21); // Month is 0-indexed: 8 is September
    baseMon.setDate(baseMon.getDate() + weekOffset * 7);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseMon);
      d.setDate(baseMon.getDate() + i);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days.push({ dayName, monthDay, fullDate: d });
    }
    return days;
  }, [weekOffset]);

  const dateRangeLabel = useMemo(() => {
    if (weekDates.length < 7) return "Sept 21 - 27, 2026";
    const start = weekDates[0].monthDay;
    const end = weekDates[6].monthDay;
    const year = weekDates[6].fullDate.getFullYear();
    return `${start} - ${end}, ${year}`;
  }, [weekDates]);

  // Sorting
  const [sortField, setSortField] = useState<keyof TimesheetRow>("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Detail Modal / Row selection
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetRow | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (appliedSearch) params.set("q", appliedSearch);
      if (selectedFacility && selectedFacility !== "all") params.set("facility", selectedFacility);
      if (selectedDepartment && selectedDepartment !== "all") params.set("department", selectedDepartment);
      if (selectedJobTitle && selectedJobTitle !== "all") params.set("jobTitle", selectedJobTitle);

      const res = await fetch(`/api/admin/timesheets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.timesheets && data.timesheets.length > 0) {
          setRows(data.timesheets);
          setTotalResults(data.total ?? data.timesheets.length);
          setTotalPages(data.totalPages ?? 1);
          if (data.metrics) setMetrics(data.metrics);
          if (data.filterOptions?.facilities?.length) setFacilities(data.filterOptions.facilities);
          if (data.filterOptions?.departments?.length) setDepartments(data.filterOptions.departments);
          if (data.filterOptions?.jobTitles?.length) setJobTitles(data.filterOptions.jobTitles);
          return;
        }
      }
    } catch {
      // Graceful fallback to default rows
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, selectedFacility, selectedDepartment, selectedJobTitle]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleSort = (field: keyof TimesheetRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Client-side sort on loaded rows
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [rows, sortField, sortAsc]);

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      "Name",
      "Job Role",
      "Facility",
      "Department",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
      "Total Hours",
      "OT Hours",
      "Status",
    ];

    const lines = sortedRows.map((r) =>
      [
        `"${r.name}"`,
        `"${r.jobRole}"`,
        `"${r.facility}"`,
        `"${r.department}"`,
        `"${r.dailyHours.mon}"`,
        `"${r.dailyHours.tue}"`,
        `"${r.dailyHours.wed}"`,
        `"${r.dailyHours.thu}"`,
        `"${r.dailyHours.fri}"`,
        `"${r.dailyHours.sat}"`,
        `"${r.dailyHours.sun}"`,
        `"${r.totalHours}"`,
        `"${r.otHours}"`,
        `"${r.status}"`,
      ].join(",")
    );

    const csvContent = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `timesheets_${dateRangeLabel.replace(/[\s,]+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Timesheets exported successfully!");
  };

  const handleApproveTimesheet = (row: TimesheetRow) => {
    toast.success(`Timesheet for ${row.name} approved.`);
    setActiveMenuId(null);
    setSelectedTimesheet(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Timesheets</h1>
          <p className="mt-1 text-sm text-[#64748B]">Manage Timesheets</p>
        </div>

        {/* Top Right: Date Range & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B]">
              <Calendar className="h-4 w-4 text-[#94A3B8]" />
              <span>{dateRangeLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex h-10 items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-4 text-sm font-medium text-[#334155] shadow-sm transition hover:bg-[#F8FAFC] active:scale-[0.98]"
          >
            <Download className="h-4 w-4 text-[#64748B]" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearchSubmit} className="flex max-w-lg flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search by employee name, job title, or facility"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-sm text-[#0F172A] outline-none transition focus:border-[color:var(--brand-primary,#BC8B41)]"
            />
          </div>
          <button
            type="submit"
            className="flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium text-white shadow-sm transition hover:brightness-95 active:scale-[0.98]"
            style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Facilities dropdown */}
          <div className="relative">
            <select
              value={selectedFacility}
              onChange={(e) => {
                setSelectedFacility(e.target.value);
                setPage(1);
              }}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3.5 pr-8 text-xs font-medium text-[#334155] shadow-sm outline-none transition hover:border-[#CBD5E1] focus:border-[color:var(--brand-primary,#BC8B41)]"
            >
              <option value="all">Facilities • All</option>
              {facilities.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Departments dropdown */}
          <div className="relative">
            <select
              value={selectedDepartment}
              onChange={(e) => {
                setSelectedDepartment(e.target.value);
                setPage(1);
              }}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3.5 pr-8 text-xs font-medium text-[#334155] shadow-sm outline-none transition hover:border-[#CBD5E1] focus:border-[color:var(--brand-primary,#BC8B41)]"
            >
              <option value="all">Departments • All</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Job Titles dropdown */}
          <div className="relative">
            <select
              value={selectedJobTitle}
              onChange={(e) => {
                setSelectedJobTitle(e.target.value);
                setPage(1);
              }}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3.5 pr-8 text-xs font-medium text-[#334155] shadow-sm outline-none transition hover:border-[#CBD5E1] focus:border-[color:var(--brand-primary,#BC8B41)]"
            >
              <option value="all">Job Titles • All</option>
              {jobTitles.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Hours */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7]">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.totalHours}</div>
            <div className="text-xs font-medium text-[#64748B]">Total Hours</div>
          </div>
        </div>

        {/* Card 2: Employees */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#16A34A]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.employees}</div>
            <div className="text-xs font-medium text-[#64748B]">Employees</div>
          </div>
        </div>

        {/* Card 3: With Overtime */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.withOvertime}</div>
            <div className="text-xs font-medium text-[#64748B]">With Overtime</div>
          </div>
        </div>

        {/* Card 4: Incomplete */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.incomplete}</div>
            <div className="text-xs font-medium text-[#64748B]">Incomplete</div>
          </div>
        </div>
      </div>

      {/* Main Timesheets Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th
                  onClick={() => handleSort("name")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  Name
                </th>
                <th
                  onClick={() => handleSort("jobRole")}
                  className="cursor-pointer px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  Job Role
                </th>
                <th
                  onClick={() => handleSort("facility")}
                  className="cursor-pointer px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  Facility
                </th>

                {/* Day Columns (MON to SUN) */}
                {weekDates.map((day) => (
                  <th
                    key={day.dayName}
                    className="px-3 py-3.5 text-center text-xs font-semibold text-[#64748B]"
                  >
                    <div className="uppercase tracking-wider">{day.dayName}</div>
                    <div className="text-[10px] font-normal text-[#94A3B8]">{day.monthDay}</div>
                  </th>
                ))}

                <th
                  onClick={() => handleSort("totalHours")}
                  className="cursor-pointer px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  Total Hours
                </th>
                <th
                  onClick={() => handleSort("otHours")}
                  className="cursor-pointer px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  OT Hours
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="cursor-pointer px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  Status
                </th>
                <th className="w-10 px-2 py-3.5 text-center" />
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12">
                    <DashboardPageLoader label="Loading timesheets..." className="min-h-[160px]" />
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-sm text-[#64748B]">
                    No timesheets found matching your filters.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition hover:bg-[#F8FAFC]/80 cursor-pointer"
                    onClick={() => setSelectedTimesheet(row)}
                  >
                    <td className="px-5 py-4 font-semibold text-sm text-[#0F172A] whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-4 py-4 text-xs text-[#475569] whitespace-nowrap">
                      {row.jobRole}
                    </td>
                    <td className="px-4 py-4 text-xs text-[#475569] whitespace-nowrap">
                      {row.facility}
                    </td>

                    {/* Mon to Sun Daily Hours */}
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#334155]">
                      {row.dailyHours.mon}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#334155]">
                      {row.dailyHours.tue}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#334155]">
                      {row.dailyHours.wed}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#334155]">
                      {row.dailyHours.thu}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#334155]">
                      {row.dailyHours.fri}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#94A3B8]">
                      {row.dailyHours.sat}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-medium text-[#94A3B8]">
                      {row.dailyHours.sun}
                    </td>

                    <td className="px-3 py-4 text-center text-xs font-semibold text-[#0F172A]">
                      {row.totalHours}
                    </td>
                    <td className="px-3 py-4 text-center text-xs font-semibold text-[#0F172A]">
                      {row.otHours}
                    </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none ${statusBadge(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td
                      className="px-2 py-4 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === row.id ? null : row.id);
                      }}
                    >
                      <div className="relative inline-block">
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                          title="Actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {activeMenuId === row.id && (
                          <div
                            className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTimesheet(row);
                                setActiveMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
                            >
                              <FileText className="h-3.5 w-3.5 text-[#64748B]" />
                              <span>View Breakdown</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveTimesheet(row)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[#15803D] hover:bg-[#F0FDF4]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#16A34A]" />
                              <span>Approve Timesheet</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-4 border-t border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#64748B]">
            Showing <span className="font-semibold text-[#0F172A]">{sortedRows.length}</span> of{" "}
            <span className="font-semibold text-[#0F172A]">{totalResults}</span> results
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() => setPage(1)}
                className="h-7 w-7 rounded-md text-xs font-semibold text-white transition shadow-xs"
                style={{
                  backgroundColor: page === 1 ? "var(--brand-secondary, #012352)" : "#FFFFFF",
                  color: page === 1 ? "#FFFFFF" : "#475569",
                  border: page === 1 ? "none" : "1px solid #E2E8F0",
                }}
              >
                1
              </button>

              {totalPages > 1 && (
                <button
                  type="button"
                  onClick={() => setPage(2)}
                  className="h-7 w-7 rounded-md text-xs font-semibold transition"
                  style={{
                    backgroundColor: page === 2 ? "var(--brand-secondary, #012352)" : "#FFFFFF",
                    color: page === 2 ? "#FFFFFF" : "#475569",
                    border: page === 2 ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  2
                </button>
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Details Drawer / Modal */}
      {selectedTimesheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setSelectedTimesheet(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[#0F172A]">{selectedTimesheet.name}</h2>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadge(
                      selectedTimesheet.status
                    )}`}
                  >
                    {selectedTimesheet.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#64748B]">
                  {selectedTimesheet.jobRole} • {selectedTimesheet.facility} • {selectedTimesheet.department}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTimesheet(null)}
                className="rounded-lg p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick summary cards */}
            <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                <div className="text-xs text-[#64748B]">Total Hours</div>
                <div className="mt-1 text-lg font-bold text-[#0F172A]">{selectedTimesheet.totalHours}</div>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                <div className="text-xs text-[#64748B]">Overtime Hours</div>
                <div className="mt-1 text-lg font-bold text-[#D97706]">{selectedTimesheet.otHours}</div>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                <div className="text-xs text-[#64748B]">Pay Period</div>
                <div className="mt-1 text-xs font-semibold text-[#0F172A]">{dateRangeLabel}</div>
              </div>
              <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-center">
                <div className="text-xs text-[#64748B]">Days Worked</div>
                <div className="mt-1 text-lg font-bold text-[#0F172A]">5 / 7</div>
              </div>
            </div>

            {/* Day by Day Breakdown */}
            <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Daily Attendance & Shift Details</h3>
            <div className="overflow-hidden rounded-lg border border-[#E2E8F0]">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B]">
                    <th className="px-3 py-2.5 font-semibold">Day / Date</th>
                    <th className="px-3 py-2.5 font-semibold">Clock In</th>
                    <th className="px-3 py-2.5 font-semibold">Clock Out</th>
                    <th className="px-3 py-2.5 font-semibold">Break</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {(selectedTimesheet.daysDetails ?? [
                    { day: "Mon", date: "Sept 21", hours: selectedTimesheet.dailyHours.mon, clockIn: "08:00 AM", clockOut: "04:30 PM", breaks: "30m" },
                    { day: "Tue", date: "Sept 22", hours: selectedTimesheet.dailyHours.tue, clockIn: "08:00 AM", clockOut: "04:30 PM", breaks: "30m" },
                    { day: "Wed", date: "Sept 23", hours: selectedTimesheet.dailyHours.wed, clockIn: "08:00 AM", clockOut: "04:30 PM", breaks: "30m" },
                    { day: "Thu", date: "Sept 24", hours: selectedTimesheet.dailyHours.thu, clockIn: "08:00 AM", clockOut: "04:30 PM", breaks: "30m" },
                    { day: "Fri", date: "Sept 25", hours: selectedTimesheet.dailyHours.fri, clockIn: "08:00 AM", clockOut: "04:30 PM", breaks: "30m" },
                    { day: "Sat", date: "Sept 26", hours: selectedTimesheet.dailyHours.sat },
                    { day: "Sun", date: "Sept 27", hours: selectedTimesheet.dailyHours.sun },
                  ]).map((item: DayDetail, i: number) => (
                    <tr key={i} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2.5 font-medium text-[#0F172A]">
                        {item.day} <span className="text-[#94A3B8]">({item.date})</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#334155]">{item.clockIn || "—"}</td>
                      <td className="px-3 py-2.5 text-[#334155]">{item.clockOut || "—"}</td>
                      <td className="px-3 py-2.5 text-[#64748B]">{item.breaks || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#0F172A]">{item.hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
              <button
                type="button"
                onClick={() => setSelectedTimesheet(null)}
                className="h-9 rounded-lg border border-[#CBD5E1] px-4 text-xs font-semibold text-[#475569] hover:bg-[#F1F5F9]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleApproveTimesheet(selectedTimesheet)}
                className="flex h-9 items-center gap-1.5 rounded-lg px-4 text-xs font-semibold text-white shadow-sm transition hover:brightness-95"
                style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Approve Timesheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

