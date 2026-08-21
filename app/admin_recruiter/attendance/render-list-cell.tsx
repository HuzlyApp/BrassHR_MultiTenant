import type { ReactNode } from "react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import type { AttendanceColumnId } from "./column-config";

type AttendanceStatus = "clocked_in" | "clocked_out";

type BreakInterval = { started_at: string; ended_at: string };

export type AttendanceRow = {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  profile_photo_url?: string | null;
  attendance_date: string;
  status: AttendanceStatus;
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  break_started_at?: string | null;
  break_seconds?: number | null;
  break_intervals?: BreakInterval[] | null;
  clock_in_ip: string;
  clock_out_ip: string | null;
  clock_in_address: string | null;
  clock_out_address: string | null;
  clock_in_latitude: number;
  clock_in_longitude: number;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  claimed_at?: string | null;
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

function isOnBreak(log: AttendanceRow) {
  return log.status === "clocked_in" && Boolean(log.break_started_at);
}

function statusLabel(log: AttendanceRow) {
  if (isOnBreak(log)) return "On break";
  return log.status === "clocked_in" ? "Clocked in" : "Clocked out";
}

function attendanceStatusBadgeClass(log: AttendanceRow): string {
  if (isOnBreak(log)) {
    return "border border-[#0062FF] bg-[#0062FF] text-white";
  }
  if (log.status === "clocked_in") {
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

function parseBreakIntervals(log: AttendanceRow): BreakInterval[] {
  if (!Array.isArray(log.break_intervals)) return [];
  return log.break_intervals.filter(
    (item): item is BreakInterval =>
      Boolean(item) &&
      typeof item.started_at === "string" &&
      typeof item.ended_at === "string"
  );
}

function renderBreakTimeCell(log: AttendanceRow): ReactNode {
  const intervals = parseBreakIntervals(log);
  const rows: Array<{ inAt: string; outAt: string | null }> = intervals.map((item) => ({
    inAt: item.started_at,
    outAt: item.ended_at,
  }));

  if (log.break_started_at) {
    rows.push({ inAt: log.break_started_at, outAt: null });
  }

  if (rows.length === 0) {
    return <span className="text-sm text-[#94A3B8]">—</span>;
  }

  return (
    <div className="flex min-w-[200px] flex-col gap-2">
      {rows.map((row, index) => (
        <div key={`${row.inAt}-${index}`} className="text-sm leading-5 text-[#374151]">
          {rows.length > 1 ? (
            <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Break {index + 1}
            </div>
          ) : null}
          <div>
            <span className="font-semibold text-[#64748B]">In:</span> {formatDateTime(row.inAt)}
          </div>
          <div>
            <span className="font-semibold text-[#64748B]">Out:</span>{" "}
            {row.outAt ? formatDateTime(row.outAt) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderAttendanceListCell(col: AttendanceColumnId, log: AttendanceRow): ReactNode {
  switch (col) {
    case "applicant":
      return (
        <div className="flex min-w-0 items-center gap-3">
          <CandidateListAvatar
            name={log.applicant_name || "NA"}
            photoUrl={log.profile_photo_url}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-black">{log.applicant_name || "—"}</div>
            <div className="truncate text-xs text-[#4B5563]">{log.applicant_email || "—"}</div>
          </div>
        </div>
      );
    case "email":
      return <span className="text-sm text-[#374151]">{log.applicant_email ?? "—"}</span>;
    case "date":
      return <span className="text-sm text-[#374151]">{log.attendance_date}</span>;
    case "clockIn":
      return <span className="text-sm text-[#374151]">{formatDateTime(log.clock_in_at)}</span>;
    case "clockOut":
      return <span className="text-sm text-[#374151]">{formatDateTime(log.clock_out_at)}</span>;
    case "breakTime":
      return renderBreakTimeCell(log);
    case "totalHours":
      return <span className="text-sm text-[#374151]">{formatDuration(log.total_seconds)}</span>;
    case "clockInIp":
      return <span className="text-sm text-[#374151]">{log.clock_in_ip}</span>;
    case "clockOutIp":
      return <span className="text-sm text-[#374151]">{log.clock_out_ip ?? "—"}</span>;
    case "clockInLocation":
      return (
        <span className="block max-w-[220px] text-sm text-[#374151]">
          {locationText(log.clock_in_address, log.clock_in_latitude, log.clock_in_longitude)}
        </span>
      );
    case "clockOutLocation":
      return (
        <span className="block max-w-[220px] text-sm text-[#374151]">
          {locationText(log.clock_out_address, log.clock_out_latitude, log.clock_out_longitude)}
        </span>
      );
    case "status":
      return (
        <span
          className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-semibold ${attendanceStatusBadgeClass(log)}`}
        >
          {statusLabel(log)}
        </span>
      );
    default:
      return <span className="text-sm text-[#374151]">—</span>;
  }
}
