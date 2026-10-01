import { easternDateString, formatEastern } from "@/lib/datetime/eastern";
import type {
  AppointmentStatus,
  AttendanceLog,
  MeetingType,
  WorkerInterviewStatus,
} from "./types";

export function meetingTypeLabel(type: MeetingType | null | undefined) {
  if (type === "online") return "Online";
  if (type === "phone") return "Phone call";
  if (type === "in_person") return "In-person";
  return "Meeting";
}

export function scheduleStatusLabel(status: AppointmentStatus | null | undefined) {
  if (status === "requested") return "Requested";
  if (status === "confirmed") return "Confirmed";
  if (status === "rescheduled") return "Rescheduled";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

export function interviewStatusLabel(status: WorkerInterviewStatus | null | undefined) {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (status === "rescheduled") return "Rescheduled";
  return "Upcoming";
}

export function formatScheduleDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { timeZone: "America/New_York", 
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateOnly(iso: string | null | undefined) {
  return formatEastern(iso, { month: "long", day: "numeric", year: "numeric" }, "—");
}

export function formatTimeParts(iso: string | null | undefined) {
  if (!iso) return { time: "—", meridiem: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { time: "—", meridiem: "" };
  const parts = date.toLocaleTimeString("en-US", { timeZone: "America/New_York", 
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const match = parts.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (match) return { time: match[1], meridiem: match[2].toUpperCase() };
  return { time: parts, meridiem: "" };
}

export function formatTimeRange(startIso: string | null | undefined, endIso: string | null | undefined) {
  const start = formatTimeParts(startIso);
  const end = formatTimeParts(endIso);
  if (start.time === "—" || end.time === "—") return "—";
  return `${start.time} ${start.meridiem}`.trim() + " - " + `${end.time} ${end.meridiem}`.trim();
}

export function formatDurationParts(seconds: number | null | undefined) {
  if (seconds == null) return { hours: "0", minutes: "00" };
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return {
    hours: String(hours),
    minutes: String(minutes).padStart(2, "0"),
  };
}

export function formatDurationShort(seconds: number | null | undefined) {
  const { hours, minutes } = formatDurationParts(seconds);
  return `${hours} hrs ${minutes} mins`;
}

/** Compact duration for timesheet header — e.g. "0h", "2h 30m" */
export function formatDurationCompact(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return "0h";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function attendanceStatusLabel(log: AttendanceLog | null) {
  if (!log) return "Not clocked in";
  return log.status === "clocked_in" ? "Clocked in" : "Clocked out";
}

export function locationDisplay(
  address: string | null | undefined,
  lat: number | null | undefined,
  lng: number | null | undefined
) {
  if (address?.trim()) return address;
  if (lat != null && lng != null) return `${lat}, ${lng}`;
  return "—";
}

export function isSameCalendarDay(a: Date, b: Date) {
  return easternDateString(a) === easternDateString(b);
}

export function dayLabel(dateIso: string) {
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(dateIso.trim());
  if (dateOnly && dateIso.trim().length === 10) {
    if (dateOnly[1] === easternDateString(new Date())) return "Today";
    return formatEastern(dateOnly[1], { weekday: "long", month: "short", day: "numeric" });
  }
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  if (isSameCalendarDay(date, new Date())) return "Today";
  return date.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
