import type { ReactNode } from "react";
import { CandidateListAvatar } from "@/app/admin_recruiter/components/CandidateListAvatar";
import type { AttendanceColumnId } from "./column-config";

type AttendanceStatus = "clocked_in" | "clocked_out";

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
          className={`inline-flex items-center whitespace-nowrap rounded-sm px-2 py-0.5 text-[10px] font-semibold ${attendanceStatusBadgeClass(log.status)}`}
        >
          {statusLabel(log.status)}
        </span>
      );
    default:
      return <span className="text-sm text-[#374151]">—</span>;
  }
}
