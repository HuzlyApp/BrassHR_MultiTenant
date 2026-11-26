"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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

  const filterControlClassName =
    "h-[30px] cursor-pointer appearance-none rounded-[8px] border border-[#CBD5E1] bg-white pl-2.5 pr-7 text-[10px] leading-[15px] text-[#0F172A] outline-none transition hover:border-[#94A3B8] focus-visible:border-[color:var(--brand-primary,#012352)]";

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 md:px-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-[#0F172A]">
            Who is off
          </h1>
          <p className="mt-1 text-xs leading-4 text-[#6B7280]">
            View employees who are off during the selected date range.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <button
            type="button"
            className="inline-flex h-[30px] w-8 items-center justify-center rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            aria-label="Previous range"
            onClick={() => {
              setPage(1);
              setAnchorDate((current) => addEasternDays(current, -7));
            }}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <div className="inline-flex h-[30px] min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[#CBD5E1] bg-white px-2.5 text-[10px] leading-[15px] text-[#0F172A] sm:min-w-[160px] sm:flex-none">
            <Calendar className="h-3 w-3 shrink-0 text-[#94A3B8]" aria-hidden />
            <span className="truncate">{dateRangeText}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
          </div>
          <button
            type="button"
            className="inline-flex h-[30px] w-8 items-center justify-center rounded-[8px] border border-[#CBD5E1] bg-white text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0F172A]"
            aria-label="Next range"
            onClick={() => {
              setPage(1);
              setAnchorDate((current) => addEasternDays(current, 7));
            }}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mb-4">
        <Suspense fallback={null}>
          <SchedulingSubNav />
        </Suspense>
      </div>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-[30px]">
        <form onSubmit={handleSearchSubmit} className="flex min-w-0 w-full flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search worker..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-[30px] w-full rounded-[8px] border-0 bg-white pl-8 pr-2.5 text-[10px] leading-[15px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--brand-primary,#012352)_16%,transparent)]"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-[30px] w-full shrink-0 items-center justify-center rounded-[8px] bg-[color:var(--brand-secondary)] px-2.5 text-[10px] font-semibold leading-[15px] text-white transition hover:brightness-95 sm:w-auto"
          >
            Search
          </button>
        </form>

        <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              value={selectedFacility}
              onChange={(e) => {
                setSelectedFacility(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by facility"
              className={`${filterControlClassName} w-full sm:w-auto`}
            >
              <option value="all">All Facilities</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden
            />
          </div>

          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              value={selectedOffType}
              onChange={(e) => {
                setSelectedOffType(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by off type"
              className={`${filterControlClassName} w-full sm:w-auto`}
            >
              <option value="all">All Off types</option>
              {offTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              aria-hidden
            />
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E2E8F0] bg-white shadow-sm">
        {/* Mobile cards — desktop table unchanged below */}
        <div className="divide-y divide-[#F1F5F9] md:hidden">
          {loading ? (
            <div className="py-12">
              <DashboardPageLoader />
            </div>
          ) : sortedRecords.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[#64748B]">
              No employees are off during this date range.
            </p>
          ) : (
            sortedRecords.map((item) => (
              <article key={`mobile-${item.id}`} className="space-y-2 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[#0F172A]">{item.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-[#475569]">{item.jobRole}</p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-none ${offTypeBadge(
                      item.offType
                    )}`}
                  >
                    {item.offType}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div>
                    <dt className="text-[#94A3B8]">Facility</dt>
                    <dd className="font-medium text-[#334155]">{item.facility}</dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Days</dt>
                    <dd className="font-medium text-[#0F172A]">{item.days}</dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Start</dt>
                    <dd className="font-medium text-[#334155]">{formatEastern(item.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">End</dt>
                    <dd className="font-medium text-[#334155]">{formatEastern(item.endDate)}</dd>
                  </div>
                </dl>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                className={`h-7 w-7 rounded-[8px] text-xs font-semibold transition ${
                  page === 1
                    ? "bg-[color:var(--brand-primary,#012352)] text-white"
                    : "border border-[#E2E8F0] bg-white text-[#475569]"
                }`}
              >
                1
              </button>

              {totalPages > 1 ? (
                <button
                  type="button"
                  onClick={() => setPage(2)}
                  className={`h-7 w-7 rounded-[8px] text-xs font-semibold transition ${
                    page === 2
                      ? "bg-[color:var(--brand-primary,#012352)] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#475569]"
                  }`}
                >
                  2
                </button>
              ) : null}

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

