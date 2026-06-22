"use client";

import { useCallback, useEffect, useState } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  CANDIDATES_FILTER_CONTROL_CLASS,
  CANDIDATES_FILTER_LABEL_CLASS,
  CANDIDATES_PAGE_SUBTITLE_STYLE,
} from "@/app/admin_recruiter/candidates/candidates-typography";
import { CandidatesPageHeader } from "@/app/admin_recruiter/components/CandidatesPageHeader";
import { Filter, Loader2, RefreshCw, Search } from "lucide-react";

type AttendanceStatus = "clocked_in" | "clocked_out";

type AttendanceRow = {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_address: string | null;
  clock_out_address: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "In progress";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function statusLabel(status: AttendanceStatus) {
  return status === "clocked_in" ? "Clocked in" : "Clocked out";
}

function attendanceStatusBadgeClass(status: AttendanceStatus): string {
  if (status === "clocked_in") {
    return "border border-[#22C55E] bg-[#22C55E] text-white";
  }
  return "border border-[#64748B] bg-[#64748B] text-white";
}

function locationText(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined
) {
  if (address?.trim()) return address;
  if (lat == null || lng == null) return "—";
  return `${lat}, ${lng}`;
}

export default function AdminApplicantAttendancePage() {
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [showFilterRows, setShowFilterRows] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (date) params.set("date", date);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/applicant-attendance?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        logs?: AttendanceRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Failed to load attendance logs.");
      setLogs(payload.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance logs.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date, q, status]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="px-5 pb-8 pt-5 lg:px-8">
      <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
        <CandidatesPageHeader
          title="Time & Attendance"
          subtitle="Review clock-in and clock-out logs for your team"
        />

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
            <div className="flex h-[52px] w-full shrink-0 items-center gap-3 px-[14px]">
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
                <label className="flex items-center gap-2">
                  <span className={CANDIDATES_FILTER_LABEL_CLASS} style={CANDIDATES_PAGE_SUBTITLE_STYLE}>
                    Status
                  </span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={CANDIDATES_FILTER_CONTROL_CLASS}
                    style={CANDIDATES_PAGE_SUBTITLE_STYLE}
                  >
                    <option value="">All</option>
                    <option value="clocked_in">Clocked in</option>
                    <option value="clocked_out">Clocked out</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex w-full items-center gap-3 px-[14px] py-3">
          <div className="text-xs leading-4 text-[#5e7371]">
            Total:{" "}
            <span className="font-semibold text-[#203130]">{loading ? "—" : logs.length}</span> records
          </div>
        </div>

        {error ? (
          <div className="mx-[14px] mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <div className="bg-white px-[14px] pb-4">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
              <Loader2 className="h-6 w-6 animate-spin text-[color:var(--brand-primary)]" />
              Loading attendance logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-gray-600">No attendance logs found.</div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[#E5E7EB]">
              <div className="overflow-auto">
                <table className="min-w-[1200px] w-full border-collapse">
                  <thead className="bg-[#F8FAFC]">
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Applicant
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Email
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Date
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock In
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock Out
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Total Hours
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock-in IP
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock-out IP
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock-in Location
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Clock-out Location
                      </th>
                      <th className="bg-[#E5E7EB] px-4 py-3 text-left text-sm font-medium uppercase tracking-[0.08em] text-black">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-[#E9EDF3] hover:bg-[#F9FBFB]">
                        <td className="px-4 py-4 text-sm font-medium text-[#111827]">{log.applicant_name}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{log.applicant_email ?? "—"}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{log.attendance_date}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{formatDateTime(log.clock_in_at)}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{formatDateTime(log.clock_out_at)}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{formatDuration(log.total_seconds)}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{log.clock_in_ip}</td>
                        <td className="px-4 py-4 text-sm text-[#374151]">{log.clock_out_ip ?? "—"}</td>
                        <td className="max-w-[220px] px-4 py-4 text-sm text-[#374151]">
                          {locationText(log.clock_in_address, log.clock_in_latitude, log.clock_in_longitude)}
                        </td>
                        <td className="max-w-[220px] px-4 py-4 text-sm text-[#374151]">
                          {locationText(
                            log.clock_out_address,
                            log.clock_out_latitude,
                            log.clock_out_longitude
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-semibold ${attendanceStatusBadgeClass(log.status)}`}
                          >
                            {statusLabel(log.status)}
                          </span>
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
