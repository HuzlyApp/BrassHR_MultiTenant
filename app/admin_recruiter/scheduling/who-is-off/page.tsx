"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Calendar, ChevronDown, ArrowUpDown } from "lucide-react";
import DashboardPageLoader from "@/app/admin_recruiter/components/DashboardPageLoader";
import { SchedulingSubNav } from "@/app/admin_recruiter/scheduling/SchedulingSubNav";
import type { OffRecord } from "@/app/api/admin/scheduling/who-is-off/route";
import { addEasternDays, easternDateString, formatEastern, startOfEasternWeek } from "@/lib/datetime/eastern";

function offTypeBadge(type: string) {
  switch (type.toLowerCase()) {
    case "vacation":
      return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
    case "sick leave":
      return "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]";
    case "personal leave":
      return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
    case "training":
      return "bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]";
    default:
      return "bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]";
  }
}

export default function WhoIsOffPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<OffRecord[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("all");
  const [selectedOffType, setSelectedOffType] = useState("all");

  // Options
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string }>>([]);
  const [offTypes, setOffTypes] = useState<string[]>([
    "Vacation",
    "Sick Leave",
    "Personal Leave",
    "Training",
    "Regular Off",
  ]);

  const weekDays = useMemo(() => {
    const weekStart = startOfEasternWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => addEasternDays(weekStart, index));
  }, [anchorDate]);

  const startDate = easternDateString(weekDays[0] ?? new Date());
  const endDate = easternDateString(weekDays[6] ?? new Date());
  const dateRangeText = `${formatEastern(startDate)} - ${formatEastern(endDate)}`;

  // Sorting
  const [sortField, setSortField] = useState<keyof OffRecord>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        start: startDate,
        end: endDate,
      });
      if (appliedSearch) params.set("q", appliedSearch);
      if (selectedFacility && selectedFacility !== "all") params.set("facility", selectedFacility);
      if (selectedOffType && selectedOffType !== "all") params.set("offType", selectedOffType);

      const res = await fetch(`/api/admin/scheduling/who-is-off?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRecords([]);
        setTotalResults(0);
        setTotalPages(1);
        return;
      }
      setRecords(Array.isArray(data.records) ? data.records : []);
      setTotalResults(typeof data.total === "number" ? data.total : 0);
      setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
      if (Array.isArray(data.facilities)) setFacilities(data.facilities);
      if (Array.isArray(data.offTypes) && data.offTypes.length > 0) setOffTypes(data.offTypes);
    } catch {
      setRecords([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, selectedFacility, selectedOffType, startDate, endDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const handleSort = (field: keyof OffRecord) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [records, sortField, sortAsc]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      {/* Sub navigation between Week View and Who is off */}
      <SchedulingSubNav />

      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Who is off</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            View employees who are off during the selected date range.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#E2E8F0] bg-white p-0.5 shadow-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#1E293B]">
              <Calendar className="h-4 w-4 text-[#94A3B8]" />
              <span>{dateRangeText}</span>
              <ChevronDown className="h-3.5 w-3.5 text-[#94A3B8]" />
            </div>

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Previous range"
              onClick={() => {
                setPage(1);
                setAnchorDate((current) => addEasternDays(current, -7));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Next range"
              onClick={() => {
                setPage(1);
                setAnchorDate((current) => addEasternDays(current, 7));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Search input + gold button */}
        <form onSubmit={handleSearchSubmit} className="flex max-w-md flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search worker"
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

        {/* Dropdowns */}
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
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Of Types dropdown */}
          <div className="relative">
            <select
              value={selectedOffType}
              onChange={(e) => {
                setSelectedOffType(e.target.value);
                setPage(1);
              }}
              className="h-10 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3.5 pr-8 text-xs font-medium text-[#334155] shadow-sm outline-none transition hover:border-[#CBD5E1] focus:border-[color:var(--brand-primary,#BC8B41)]"
            >
              <option value="all">Of Types • All</option>
              {offTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th
                  onClick={() => handleSort("name")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("jobRole")}
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
                  onClick={() => handleSort("offType")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Off Type</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("startDate")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Start Date</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("endDate")}
                  className="cursor-pointer px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>End Date</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("days")}
                  className="cursor-pointer px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-[#64748B] hover:text-[#0F172A]"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Days</span>
                    <ArrowUpDown className="h-3 w-3 text-[#94A3B8]" />
                  </div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <DashboardPageLoader />
                  </td>
                </tr>
              ) : sortedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#64748B]">
                    No employees are off during this date range.
                  </td>
                </tr>
              ) : (
                sortedRecords.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-[#F8FAFC]/70">
                    <td className="px-5 py-4 font-semibold text-sm text-[#0F172A]">
                      {item.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#334155]">{item.jobRole}</td>
                    <td className="px-5 py-4 text-sm text-[#475569]">{item.facility}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none ${offTypeBadge(
                          item.offType
                        )}`}
                      >
                        {item.offType}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#334155]">{formatEastern(item.startDate)}</td>
                    <td className="px-5 py-4 text-sm text-[#334155]">{formatEastern(item.endDate)}</td>
                    <td className="px-5 py-4 text-right font-medium text-sm text-[#0F172A]">
                      {item.days}
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
            Showing <span className="font-semibold text-[#0F172A]">{sortedRecords.length}</span> of{" "}
            <span className="font-semibold text-[#0F172A]">{totalResults}</span> results
          </div>

          <div className="flex items-center gap-3">
            {/* Show N dropdown */}
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

            {/* Pagination Controls */}
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
    </div>
  );
}

