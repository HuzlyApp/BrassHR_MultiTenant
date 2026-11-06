"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  UserX,
  Coffee,
  CalendarCheck,
  MoreVertical,
  CheckCircle,
  MapPin,
  ArrowUpDown,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { ScrollableFilterSelect } from "@/app/admin_recruiter/components/ScrollableFilterSelect";
import { adminWorkerProfileHref } from "@/app/admin_recruiter/workers/worker-profile-links";

type AttendanceRowItem = {
  id: string;
  worker_id: string;
  applicant_name: string;
  applicant_email: string | null;
  job_role?: string | null;
  job_requisition_id?: string | null;
  facility_name?: string | null;
  scheduled_shift?: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_formatted?: string;
  clock_out_formatted?: string;
  total_seconds: number | null;
  hours_formatted?: string;
  computed_status?: "On Shift" | "Not Clocked In" | "On Break" | "Completed";
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_in_address?: string | null;
  clock_out_address?: string | null;
  claimed_at?: string | null;
};

// Demo rows matching Figma screen 3 when DB logs are empty.
// Facility / scheduled shift stay empty — those are not on attendance logs yet.
const DEMO_ROWS: AttendanceRowItem[] = [
  {
    id: "att-1",
    worker_id: "w-1",
    applicant_name: "Priya Shah",
    applicant_email: "priya.shah@example.com",
    job_role: "Warehouse Staff",
    facility_name: undefined,
    scheduled_shift: undefined,
    clock_in_at: "2026-09-21T05:58:00Z",
    clock_out_at: null,
    clock_in_formatted: "5:58 AM",
    clock_out_formatted: "—",
    total_seconds: 15120,
    hours_formatted: "4h 12m",
    computed_status: "On Shift",
  },
  {
    id: "att-2",
    worker_id: "w-2",
    applicant_name: "Ana Ruiz",
    applicant_email: "ana.ruiz@example.com",
    job_role: "Inventory Clerk",
    facility_name: undefined,
    scheduled_shift: undefined,
    clock_in_at: "2026-09-21T08:00:00Z",
    clock_out_at: null,
    clock_in_formatted: "—",
    clock_out_formatted: "—",
    total_seconds: 0,
    hours_formatted: "0m",
    computed_status: "Not Clocked In",
  },
  {
    id: "att-3",
    worker_id: "w-3",
    applicant_name: "Sophia Mitchell",
    applicant_email: "sophia.mitchell@example.com",
    job_role: "Maintenance",
    facility_name: undefined,
    scheduled_shift: undefined,
    clock_in_at: "2026-09-21T13:24:00Z",
    clock_out_at: null,
    clock_in_formatted: "1:24 AM",
    clock_out_formatted: "—",
    total_seconds: 18000,
    hours_formatted: "5h",
    computed_status: "On Shift",
  },
  {
    id: "att-4",
    worker_id: "w-4",
    applicant_name: "Olivia Bennett",
    applicant_email: "olivia.bennett@example.com",
    job_role: "Admin Assistant",
    facility_name: undefined,
    scheduled_shift: undefined,
    clock_in_at: "2026-09-21T07:24:00Z",
    clock_out_at: "2026-09-21T17:00:00Z",
    clock_in_formatted: "7:24 AM",
    clock_out_formatted: "5:00 PM",
    total_seconds: 28800,
    hours_formatted: "8h",
    computed_status: "Completed",
  },
  {
    id: "att-5",
    worker_id: "w-5",
    applicant_name: "Michael Reynolds",
    applicant_email: "michael.reynolds@example.com",
    job_role: "Picker",
    facility_name: undefined,
    scheduled_shift: undefined,
    clock_in_at: "2026-09-21T13:34:00Z",
    clock_out_at: null,
    clock_in_formatted: "1:34 PM",
    clock_out_formatted: "—",
    total_seconds: 10800,
    hours_formatted: "3h",
    computed_status: "On Break",
  },
];

function statusBadge(status?: string) {
  switch (status) {
    case "On Shift":
      return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
    case "Not Clocked In":
      return "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]";
    case "On Break":
      return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
    case "Completed":
      return "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]";
    default:
      return "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]";
  }
}

export default function ClockInsAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AttendanceRowItem[]>([]);
  const [metrics, setMetrics] = useState({
    clockedIn: 122,
    notClockedIn: 36,
    onBreak: 22,
    totalScheduled: 122,
  });

  // Filter dropdown options (filled from API)
  const [facilities, setFacilities] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([
    "On Shift",
    "Not Clocked In",
    "On Break",
    "Completed",
  ]);

  // Selected filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Date range
  const [dateRangeText, setDateRangeText] = useState("Sept 21 - 27, 2026");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalResults, setTotalResults] = useState(100);

  // Sorting
  const [sortField, setSortField] = useState<keyof AttendanceRowItem>("applicant_name");
  const [sortAsc, setSortAsc] = useState(true);

  // Detail Modal / Actions
  const [selectedRowDetail, setSelectedRowDetail] = useState<AttendanceRowItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set("q", appliedSearch);
      if (selectedFacility && selectedFacility !== "all") params.set("facility", selectedFacility);
      if (selectedDepartment && selectedDepartment !== "all") params.set("department", selectedDepartment);
      if (selectedStatus && selectedStatus !== "all") params.set("status", selectedStatus);

      const res = await fetch(`/api/admin/applicant-attendance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));

        const loadedLogs = (data.logs ?? []) as AttendanceRowItem[];
        if (loadedLogs.length > 0) {
          setRows(loadedLogs);
          setTotalResults(loadedLogs.length);
        } else {
          // Fall back to DEMO_ROWS matching Figma screen
          setRows(DEMO_ROWS);
          setTotalResults(100);
        }

        if (data.metrics) {
          setMetrics(data.metrics);
        }
        const filterOptions = data.filterOptions as
          | { facilities?: string[]; departments?: string[]; statuses?: string[] }
          | undefined;
        setFacilities(
          Array.isArray(filterOptions?.facilities)
            ? filterOptions.facilities.filter(Boolean)
            : []
        );
        setDepartments(
          Array.isArray(filterOptions?.departments)
            ? filterOptions.departments.filter(Boolean)
            : []
        );
        if (Array.isArray(filterOptions?.statuses) && filterOptions.statuses.length > 0) {
          setStatuses(filterOptions.statuses.filter(Boolean));
        }
      } else {
        setRows(DEMO_ROWS);
        setTotalResults(100);
        setFacilities([]);
        setDepartments(
          Array.from(
            new Set(DEMO_ROWS.map((row) => row.job_role?.trim() || "").filter(Boolean))
          )
        );
      }
    } catch {
      setRows(DEMO_ROWS);
      setTotalResults(100);
      setFacilities([]);
      setDepartments(
        Array.from(
          new Set(DEMO_ROWS.map((row) => row.job_role?.trim() || "").filter(Boolean))
        )
      );
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, selectedFacility, selectedDepartment, selectedStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleSort = (field: keyof AttendanceRowItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Client-side filtering & sorting
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    if (appliedSearch) {
      const q = appliedSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.applicant_name?.toLowerCase().includes(q) ||
          r.job_role?.toLowerCase().includes(q) ||
          r.facility_name?.toLowerCase().includes(q)
      );
    }

    if (selectedFacility && selectedFacility !== "all") {
      result = result.filter((r) => r.facility_name === selectedFacility);
    }

    if (selectedDepartment && selectedDepartment !== "all") {
      result = result.filter((r) => r.job_role === selectedDepartment);
    }

    if (selectedStatus && selectedStatus !== "all") {
      result = result.filter((r) => r.computed_status?.toLowerCase() === selectedStatus.toLowerCase());
    }

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [rows, appliedSearch, selectedFacility, selectedDepartment, selectedStatus, sortField, sortAsc]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;

  // CSV Export handler
  const handleExportCsv = () => {
    const headers = ["Name", "Job Role", "Facility", "Scheduled Shift", "Clock In", "Clock Out", "Status", "Hours"];
    const csvContent = [
      headers.join(","),
      ...filteredAndSortedRows.map((r) =>
        [
          `"${r.applicant_name}"`,
          `"${r.job_role || "—"}"`,
          `"${r.facility_name || "—"}"`,
          `"${r.scheduled_shift || "—"}"`,
          `"${r.clock_in_formatted || "—"}"`,
          `"${r.clock_out_formatted || "—"}"`,
          `"${r.computed_status || "—"}"`,
          `"${r.hours_formatted || "0m"}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `clock-ins-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendance report exported to CSV!");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Clock-ins</h1>
          <p className="mt-1 text-sm text-[#64748B]">Manage Workers Time</p>
        </div>

        {/* Top Right: Date Range & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 shadow-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B]">
              <Calendar className="h-4 w-4 text-[#94A3B8]" />
              <span>{dateRangeText}</span>
            </div>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Previous date range"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Next date range"
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

        <div className="relative z-20 flex flex-wrap items-center gap-3 overflow-visible">
          <ScrollableFilterSelect
            value={selectedFacility === "all" ? "" : selectedFacility}
            onChange={(next) => {
              setSelectedFacility(next || "all");
              setPage(1);
            }}
            placeholder="Facilities • All"
            ariaLabel="Filter by facility"
            triggerClassName="!h-10 min-w-[150px]"
            options={facilities.map((facility) => ({
              value: facility,
              label: facility,
            }))}
          />
          <ScrollableFilterSelect
            value={selectedDepartment === "all" ? "" : selectedDepartment}
            onChange={(next) => {
              setSelectedDepartment(next || "all");
              setPage(1);
            }}
            placeholder="Departments • All"
            ariaLabel="Filter by department"
            triggerClassName="!h-10 min-w-[150px]"
            options={departments.map((department) => ({
              value: department,
              label: department,
            }))}
          />
          <ScrollableFilterSelect
            value={selectedStatus === "all" ? "" : selectedStatus}
            onChange={(next) => {
              setSelectedStatus(next || "all");
              setPage(1);
            }}
            placeholder="Status • All"
            ariaLabel="Filter by status"
            triggerClassName="!h-10 min-w-[140px]"
            options={statuses.map((status) => ({
              value: status,
              label: status,
            }))}
          />
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Clocked In */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCFCE7] text-[#16A34A]">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.clockedIn}</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <span>Clocked In</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            </div>
          </div>
        </div>

        {/* Card 2: Not Clocked In */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#DC2626]">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.notClockedIn}</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <span>Not Clocked In</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
            </div>
          </div>
        </div>

        {/* Card 3: On Break */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#D97706]">
            <Coffee className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.onBreak}</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <span>On Break</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
            </div>
          </div>
        </div>

        {/* Card 4: Total Scheduled */}
        <div className="flex items-center gap-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0284C7]">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-[#0F172A]">{metrics.totalScheduled}</div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <span>Total Scheduled</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#0284C7]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th
                  onClick={() => handleSort("applicant_name")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("job_role")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Job Role</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Facility
                </th>
                <th
                  onClick={() => handleSort("scheduled_shift")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Scheduled Shift</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("clock_in_formatted")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Clock In</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("clock_out_formatted")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Clock Out</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Status
                </th>
                <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Hours
                </th>
                <th className="w-12 px-3 py-3.5 text-center text-xs font-semibold text-[#64748B]">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <DashboardPageLoader />
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-[#64748B]">
                    No attendance records match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const workerId = row.worker_id?.trim() || "";
                  const workerHref = workerId ? adminWorkerProfileHref(workerId) : null;
                  const jobId = row.job_requisition_id?.trim() || "";
                  const jobRole = row.job_role?.trim() || "";
                  const jobHref = jobId
                    ? `/admin_recruiter/jobs/${encodeURIComponent(jobId)}`
                    : jobRole
                      ? `/admin_recruiter/jobs?q=${encodeURIComponent(jobRole)}`
                      : null;

                  return (
                  <tr key={row.id || idx} className="transition-colors hover:bg-[#F8FAFC]/70">
                    <td className="px-5 py-4 text-sm font-semibold text-[#0F172A]">
                      {workerHref ? (
                        <Link
                          href={workerHref}
                          className="hover:text-[color:var(--brand-primary)] hover:underline"
                          title={`Open profile for ${row.applicant_name}`}
                        >
                          {row.applicant_name}
                        </Link>
                      ) : (
                        row.applicant_name
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#334155]">
                      {jobHref && jobRole ? (
                        <Link
                          href={jobHref}
                          className="font-medium text-[#0F172A] hover:text-[color:var(--brand-primary)] hover:underline"
                          title={jobRole}
                        >
                          {jobRole}
                        </Link>
                      ) : (
                        jobRole || "—"
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#475569]">{row.facility_name || "—"}</td>
                    <td className="px-5 py-4 text-sm text-[#334155]">{row.scheduled_shift || "—"}</td>
                    <td className="px-5 py-4 text-sm font-medium text-[#1E293B]">
                      {row.clock_in_formatted || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#64748B]">{row.clock_out_formatted || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none ${statusBadge(
                          row.computed_status
                        )}`}
                      >
                        {row.computed_status || "On Shift"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-sm text-[#0F172A]">
                      {row.hours_formatted || "0m"}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedRowDetail(row)}
                        className="rounded-md p-1.5 text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                        title="View Details"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-4 border-t border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-[#64748B]">
            Showing <span className="font-semibold text-[#0F172A]">{paginatedRows.length}</span> of{" "}
            <span className="font-semibold text-[#0F172A]">{filteredAndSortedRows.length}</span> results
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

      {/* Row Detail Dialog */}
      {selectedRowDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-[#0F172A]">
              {selectedRowDetail.worker_id?.trim() ? (
                <Link
                  href={adminWorkerProfileHref(selectedRowDetail.worker_id.trim())}
                  className="hover:text-[color:var(--brand-primary)] hover:underline"
                >
                  {selectedRowDetail.applicant_name}
                </Link>
              ) : (
                selectedRowDetail.applicant_name
              )}
            </h3>
            <p className="text-xs text-[#64748B]">
              {(() => {
                const jobId = selectedRowDetail.job_requisition_id?.trim() || "";
                const jobRole = selectedRowDetail.job_role?.trim() || "";
                const facility = selectedRowDetail.facility_name?.trim() || "";
                const jobHref = jobId
                  ? `/admin_recruiter/jobs/${encodeURIComponent(jobId)}`
                  : jobRole
                    ? `/admin_recruiter/jobs?q=${encodeURIComponent(jobRole)}`
                    : null;
                const jobNode = jobHref && jobRole ? (
                  <Link
                    href={jobHref}
                    className="font-medium text-[#0F172A] hover:text-[color:var(--brand-primary)] hover:underline"
                  >
                    {jobRole}
                  </Link>
                ) : (
                  jobRole || null
                );
                if (!jobNode && !facility) return "—";
                return (
                  <>
                    {jobNode}
                    {jobNode && facility ? " • " : null}
                    {facility || null}
                  </>
                );
              })()}
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-[#64748B]">Scheduled Shift</span>
                <span className="font-medium text-[#0F172A]">
                  {selectedRowDetail.scheduled_shift || "—"}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-[#64748B]">Clock In</span>
                <span className="font-medium text-[#0F172A]">{selectedRowDetail.clock_in_formatted}</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-[#64748B]">Clock Out</span>
                <span className="font-medium text-[#0F172A]">{selectedRowDetail.clock_out_formatted}</span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-[#64748B]">Status</span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadge(
                    selectedRowDetail.computed_status
                  )}`}
                >
                  {selectedRowDetail.computed_status}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#F1F5F9] pb-2">
                <span className="text-[#64748B]">Total Hours</span>
                <span className="font-bold text-[#0F172A]">{selectedRowDetail.hours_formatted}</span>
              </div>
              {selectedRowDetail.clock_in_address && (
                <div className="flex items-start gap-2 pt-1 text-xs text-[#64748B]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-[#94A3B8]" />
                  <span>Clock In: {selectedRowDetail.clock_in_address}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRowDetail(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                style={{ backgroundColor: "var(--brand-primary, #BC8B41)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
