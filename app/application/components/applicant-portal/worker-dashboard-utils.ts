import type { ApplicantNote, Appointment, AppointmentSlot, AttendanceLog } from "./types";
import { formatDateOnly, formatTimeRange } from "./format";

export const WORKER_CHART_GREEN = "#008C36";
export const WORKER_WEEKLY_HOUR_TARGET = 40;

export type WorkerScheduleRow = {
  id: string;
  dayLabel: string;
  timeRange: string;
  location: string;
  status: "confirmed" | "requested" | "rescheduled" | "none";
};

export type WorkerAnnouncementItem = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  iconBg: string;
  iconColor: string;
  tone: "green" | "red" | "yellow";
};

const ANNOUNCEMENT_TONES: Array<{
  iconBg: string;
  iconColor: string;
  tone: WorkerAnnouncementItem["tone"];
}> = [
  { iconBg: "#ECFDF5", iconColor: "#00B546", tone: "green" },
  { iconBg: "#FEF2F2", iconColor: "#EF4444", tone: "red" },
  { iconBg: "#FEFCE8", iconColor: "#CA8A04", tone: "yellow" },
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getFirstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || "there";
}

export function getWeekRangeLabel(reference = new Date()): string {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(reference);
  start.setDate(reference.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return `${fmt(start)} – ${fmt(end)}`;
}

function resolveLocation(
  appointment: Appointment | null,
  selectedSlot: AppointmentSlot | null,
  location: string | null
): string {
  if (location?.trim()) return location;
  if (appointment?.meeting_link?.trim()) return "Online meeting";
  if (appointment?.meeting_type === "online") return "Online meeting";
  if (appointment?.meeting_type === "phone") return "Phone call";
  if (appointment?.meeting_type === "in_person") return "In-person meeting";
  if (selectedSlot?.meeting_type === "online") return "Online meeting";
  return "—";
}

function appointmentWindow(
  appointment: Appointment | null,
  selectedSlot: AppointmentSlot | null
): { start: string | null; end: string | null; location: string | null } {
  if (!appointment) {
    return { start: null, end: null, location: null };
  }

  const start = appointment.confirmed_starts_at ?? selectedSlot?.starts_at ?? null;
  const end = appointment.confirmed_ends_at ?? selectedSlot?.ends_at ?? null;
  const location = appointment.location ?? selectedSlot?.location ?? null;

  return { start, end, location };
}

function hoursBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isInCurrentWeek(date: Date, reference = new Date()): boolean {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = startOfDay(new Date(reference));
  weekStart.setDate(reference.getDate() + mondayOffset);
  const weekEnd = endOfDay(new Date(weekStart));
  weekEnd.setDate(weekStart.getDate() + 6);
  return date >= weekStart && date <= weekEnd;
}

export function formatDecimalHours(hours: number): string {
  return hours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function sumAttendanceHours(logs: AttendanceLog[], start: Date, end: Date): number {
  return logs.reduce((total, log) => {
    const date = new Date(`${log.attendance_date}T12:00:00`);
    if (date < startOfDay(start) || date > endOfDay(end)) return total;
    if (log.total_seconds != null) return total + log.total_seconds / 3600;
    if (log.status === "clocked_in" && log.clock_in_at) {
      const clockIn = new Date(log.clock_in_at);
      const elapsed = (Date.now() - clockIn.getTime()) / (1000 * 60 * 60);
      return total + Math.max(0, elapsed);
    }
    return total;
  }, 0);
}

export function getCurrentWeekBounds(reference = new Date()) {
  const day = reference.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = startOfDay(new Date(reference));
  start.setDate(reference.getDate() + mondayOffset);
  const end = endOfDay(new Date(start));
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function getPayPeriodBounds(reference = new Date()) {
  const { start: weekStart } = getCurrentWeekBounds(reference);
  const start = new Date(weekStart);
  start.setDate(weekStart.getDate() - 7);
  const end = endOfDay(new Date(weekStart));
  end.setDate(weekStart.getDate() + 6);
  return { start, end };
}

export function getUpcomingShiftSummary(
  appointment: Appointment | null,
  selectedSlot: AppointmentSlot | null
) {
  const window = appointmentWindow(appointment, selectedSlot);
  if (!window.start) {
    return {
      hasShift: false,
      dayLabel: "No shift scheduled",
      timeRange: "—",
      location: "—",
    };
  }

  const startDate = new Date(window.start);
  const today = new Date();
  const dayLabel = isSameCalendarDay(startDate, today)
    ? `Today, ${startDate.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`
    : startDate.toLocaleDateString(undefined, {
        weekday: "short",
        month: "long",
        day: "numeric",
      });

  return {
    hasShift: true,
    dayLabel,
    timeRange: formatTimeRange(window.start, window.end),
    location: resolveLocation(appointment, selectedSlot, window.location),
  };
}

export function getWeekShiftStats(
  appointment: Appointment | null,
  selectedSlot: AppointmentSlot | null
) {
  const window = appointmentWindow(appointment, selectedSlot);
  if (!window.start || !appointment) {
    return { shiftCount: 0, scheduledHours: 0 };
  }

  const startDate = new Date(window.start);
  if (!isInCurrentWeek(startDate)) {
    return { shiftCount: 0, scheduledHours: 0 };
  }

  const activeStatus = appointment.status === "confirmed" || appointment.status === "requested";
  if (!activeStatus) {
    return { shiftCount: 0, scheduledHours: 0 };
  }

  return {
    shiftCount: 1,
    scheduledHours: hoursBetween(window.start, window.end),
  };
}

export function buildWeeklyScheduleRows(
  appointment: Appointment | null,
  selectedSlot: AppointmentSlot | null
): WorkerScheduleRow[] {
  const { start: weekStart } = getCurrentWeekBounds();
  const window = appointmentWindow(appointment, selectedSlot);
  const appointmentDate = window.start ? new Date(window.start) : null;

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    const dayLabel = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
    });

    const matchesAppointment =
      appointmentDate &&
      isSameCalendarDay(day, appointmentDate) &&
      appointment &&
      appointment.status !== "cancelled";

    if (!matchesAppointment) {
      return {
        id: `day-${index}`,
        dayLabel,
        timeRange: "—",
        location: "—",
        status: "none" as const,
      };
    }

    const status =
      appointment?.status === "confirmed"
        ? ("confirmed" as const)
        : appointment?.status === "rescheduled"
          ? ("rescheduled" as const)
          : ("requested" as const);

    return {
      id: `day-${index}`,
      dayLabel,
      timeRange: formatTimeRange(window.start, window.end),
      location: resolveLocation(appointment, selectedSlot, window.location),
      status,
    };
  });
}

export function mapNotesToAnnouncements(notes: ApplicantNote[]): WorkerAnnouncementItem[] {
  return notes.slice(0, 3).map((note, index) => {
    const tone = ANNOUNCEMENT_TONES[index % ANNOUNCEMENT_TONES.length];
    const lines = note.body.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = lines[0]?.slice(0, 48) || "Team update";
    const body = lines.slice(1).join(" ") || note.body;

    return {
      id: note.id,
      title,
      body,
      dateLabel: formatDateOnly(note.created_at),
      iconBg: tone.iconBg,
      iconColor: tone.iconColor,
      tone: tone.tone,
    };
  });
}

export function getAttendanceProgress(logs: AttendanceLog[]) {
  const { start, end } = getCurrentWeekBounds();
  const weekHours = sumAttendanceHours(logs, start, end);
  const pct = Math.min(100, Math.round((weekHours / WORKER_WEEKLY_HOUR_TARGET) * 100));
  return { weekHours, pct, targetHours: WORKER_WEEKLY_HOUR_TARGET };
}

export function getPayPeriodHours(logs: AttendanceLog[]) {
  const { start, end } = getPayPeriodBounds();
  return sumAttendanceHours(logs, start, end);
}
