"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Columns2, Filter, RefreshCw, Search } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { useCandidatesFilterRowsDefault } from "@/app/admin_recruiter/hooks/useCandidatesFilterRowsDefault";
import { SchedulingSubNav } from "@/app/admin_recruiter/scheduling/SchedulingSubNav";
import { AttendanceEditColumnsModal } from "@/app/admin_recruiter/attendance/EditColumnsModal";
import { AttendanceSubTabs } from "@/app/admin_recruiter/attendance/AttendanceSubTabs";
import {
  attendanceColumnLabel,
  DEFAULT_ATTENDANCE_COLUMNS,
  loadAttendanceColumnOrder,
  saveAttendanceColumnOrder,
  type AttendanceColumnId,
} from "@/app/admin_recruiter/attendance/column-config";
import { renderAttendanceListCell, type AttendanceRow } from "@/app/admin_recruiter/attendance/render-list-cell";
import {
  attendanceBucketEmptyMessage,
  parseAttendanceBucket,
} from "@/lib/attendance/attendance-buckets";

function columnHeaderClass(colId: AttendanceColumnId): string {
  const base =
    "bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black";
  if (colId === "clockInLocation" || colId === "clockOutLocation") {
    return `${base} min-w-[200px]`;
  }
  if (colId === "clockIn" || colId === "clockOut") {
    return `${base} min-w-[160px] whitespace-nowrap`;
  }
  return base;
}

function columnCellClass(colId: AttendanceColumnId): string {
  const base = "px-4 py-4 align-middle";
  if (colId === "clockIn" || colId === "clockOut") {
    return `${base} whitespace-nowrap`;
  }
  return base;
}

function CompactFilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium leading-4 text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const bucket = parseAttendanceBucket(searchParams.get("bucket"));
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [claimTrackingEnabled, setClaimTrackingEnabled] = useState(true);
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [showFilterRows, setShowFilterRows] = useCandidatesFilterRowsDefault();
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listColumnOrder, setListColumnOrder] = useState<AttendanceColumnId[]>(DEFAULT_ATTENDANCE_COLUMNS);
  const [editColumnsOpen, setEditColumnsOpen] = useState(false);

  useEffect(() => {
    setListColumnOrder(loadAttendanceColumnOrder());
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (date) params.set("date", date);
      if (bucket !== "all") params.set("bucket", bucket);
      const res = await fetch(`/api/admin/applicant-attendance?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        logs?: AttendanceRow[];
        claimTrackingEnabled?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Failed to load attendance logs.");
      setLogs(payload.logs ?? []);
      setClaimTrackingEnabled(payload.claimTrackingEnabled !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [bucket, date, q]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleClaim = useCallback(
    async (logId: string) => {
      setClaimingId(logId);
      setError(null);
      try {
        const res = await fetch("/api/admin/applicant-attendance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: logId, action: "claim" }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Could not claim this record.");
        await loadLogs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not claim this record.");
      } finally {
        setClaimingId(null);
      }
    },
    [loadLogs]
  );

  const showClaimColumn = bucket === "unclaimed" && claimTrackingEnabled;

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <SchedulingSubNav />
      <AttendanceSubTabs />

      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <div className="flex w-full flex-col gap-0 overflow-hidden rounded-t-[8px] border-y border-[#E5E7EB] bg-white">
          <div className="flex flex-col gap-2 border-b border-[#E5E7EB] px-3 py-2.5 xl:hidden">
            <div className="flex w-full items-center gap-2">
              <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-[#dce6e3] bg-white px-3 md:h-8">
                <Search className="mr-2 h-4 w-4 shrink-0 text-[#94A3B8]" />
                <input
                  type="search"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search by name or email"
                  className="min-w-0 flex-1 bg-transparent text-base font-normal leading-6 text-[#334155] outline-none placeholder:text-[#94A3B8] sm:text-sm"
                  style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                />
              </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:grid-cols-none md:auto-cols-max md:grid-flow-col md:gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((value) => !value)}
                className={`inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium whitespace-nowrap transition max-[399px]:px-0 ${
                  showFilterRows || Boolean(date)
                    ? "border-[color:var(--brand-primary)] bg-[color:color-mix(in_srgb,var(--brand-primary)_10%,white)] text-[color:var(--brand-primary)]"
                    : "border-[#dce6e3] bg-white text-[#334155] hover:bg-zinc-50"
                }`}
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                aria-label="Filters"
                title="Filters"
              >
                <Filter className="h-4 w-4 shrink-0" />
                <span className="max-[399px]:hidden">Filters</span>
              </button>
              <button
                type="button"
                onClick={() => setEditColumnsOpen(true)}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-medium text-[#334155] transition hover:bg-zinc-50 max-[399px]:px-0"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                aria-label="Columns"
                title="Columns"
              >
                <Columns2 className="h-4 w-4" />
                <span className="max-[399px]:hidden">Columns</span>
              </button>
              <button
                type="button"
                onClick={() => void loadLogs()}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-medium text-[#334155] transition hover:bg-zinc-50 max-[399px]:px-0"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                <span className="max-[399px]:hidden">Refresh</span>
              </button>
            </div>
          </div>

          <div className="hidden h-[52px] w-full shrink-0 items-center gap-3 border-b border-[#E5E7EB] px-[14px] xl:flex">
            <div className="flex h-8 w-full min-w-0 max-w-[360px] items-center rounded-md border border-[#dce6e3] bg-white px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-[#94A3B8]" />
              <input
                type="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Search by name or email"
                className="min-w-0 flex-1 bg-transparent text-sm font-normal leading-6 text-[#334155] outline-none placeholder:text-[#94A3B8]"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilterRows((value) => !value)}
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
                onClick={() => void loadLogs()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dce6e3] bg-white px-3 text-sm font-normal leading-6 text-[#334155] transition hover:bg-zinc-50"
                style={CANDIDATES_PAGE_SUBTITLE_STYLE}
              >
                <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {showFilterRows ? (
            <>
              <div className="mx-3 my-2.5 grid grid-cols-1 gap-2 rounded-lg border border-[#E8EEEC] bg-[#F8FAFC] p-2.5 xl:hidden">
                <CompactFilterField label="Date">
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="h-10 w-full min-w-0 rounded-md border border-[#dce6e3] bg-white px-2 text-sm text-[#334155] scheme-light sm:h-9"
                  />
                </CompactFilterField>
              </div>

              <div className="hidden h-[52px] w-full shrink-0 items-center gap-3 px-[14px] xl:flex">
                <div className="flex min-w-0 items-center gap-4 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <BrandedSvgIcon
                    src="/icons/admin-recruiter/candidates/filtered.svg.svg"
                    className="h-4 w-4 shrink-0"
                    color="var(--brand-primary)"
                  />
                  <label className="flex items-center gap-2">
                    <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                      Date
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      className={`${CANDIDATES_FILTER_CONTROL_CLASS} min-w-[132px] scheme-light`}
                      style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                    />
                  </label>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex w-full items-center gap-3 px-[14px] py-3">
          <div className="text-xs leading-4 text-[#5e7371]">
            Showing:{" "}
            <span className="font-semibold text-[#203130]">{loading ? "—" : logs.length}</span> records
          </div>
        </div>

        {error ? (
          <div className="mx-[14px] mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="bg-white px-[14px] pb-4">
          {loading ? null : logs.length === 0 ? (
            <div className="py-16 text-center text-gray-600">{attendanceBucketEmptyMessage(bucket)}</div>
          ) : listColumnOrder.length === 0 ? (
            <div className="py-16 text-center text-gray-600">
              No columns selected. Open Columns to choose what to show.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
              <div className="overflow-auto">
                <table className="w-full min-w-full border-collapse">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="border-b border-[#E5E7EB]">
                      {listColumnOrder.map((colId) => (
                        <th key={colId} className={columnHeaderClass(colId)}>
                          {attendanceColumnLabel(colId)}
                        </th>
                      ))}
                      {showClaimColumn ? (
                        <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                          Action
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                        {listColumnOrder.map((colId) => (
                          <td key={colId} className={columnCellClass(colId)}>
                            {renderAttendanceListCell(colId, log)}
                          </td>
                        ))}
                        {showClaimColumn ? (
                          <td className="px-4 py-4 align-middle">
                            <button
                              type="button"
                              onClick={() => void handleClaim(log.id)}
                              disabled={claimingId === log.id}
                              className="inline-flex min-h-9 items-center rounded-full bg-[color:var(--brand-primary)] px-4 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
                            >
                              {claimingId === log.id ? "Claiming..." : "Claim"}
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <AttendanceEditColumnsModal
        key={editColumnsOpen ? "attendance-edit-cols-open" : "attendance-edit-cols-closed"}
        open={editColumnsOpen}
        onOpenChange={setEditColumnsOpen}
        value={listColumnOrder}
        onSave={(order) => {
          setListColumnOrder(order);
          saveAttendanceColumnOrder(order);
        }}
      />
    </div>
  );
}

export default function AdminApplicantAttendancePage() {
  return (
    <Suspense fallback={null}>
      <AttendancePageContent />
    </Suspense>
  );
}
