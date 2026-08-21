"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { WorkerBrandedIcon } from "./WorkerBrandedIcon";
import { WORKER_ICONS } from "./worker-icons";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { dayLabel, formatDurationCompact, formatTimeParts } from "./format";
import type { AttendanceLog } from "./types";
import {
  WORKER_PORTAL_PAGE_PAD_CLASS,
  WORKER_SCHEDULE_CARD_CLASS,
  WORKER_SCHEDULE_SUBTITLE_CLASS,
  WORKER_SCHEDULE_SUBTITLE_STYLE,
  WORKER_SCHEDULE_TITLE_CLASS,
  WORKER_SCHEDULE_TITLE_STYLE,
  WORKER_SECTION_TITLE_CLASS,
  WORKER_SECTION_TITLE_STYLE,
  WORKER_TIMESHEET_DAY_CLASS,
  WORKER_TIMESHEET_DURATION_CLASS,
  WORKER_TIMESHEET_FONT_STYLE,
  WORKER_TIMESHEET_LABEL_CLASS,
  WORKER_TIMESHEET_META_CLASS,
  WORKER_TIMESHEET_RANGE_CONTROL_CLASS,
  WORKER_TIMESHEET_VALUE_CLASS,
} from "./worker-schedule-typography";

type Props = {
  todayAttendance: AttendanceLog | null;
  recentAttendance: AttendanceLog[];
};

const BREAK_COLOR = "#0062FF";
const LEGEND_STATIC = [
  { label: "Break", color: BREAK_COLOR },
  { label: "Overtime", color: "#F59E0B" },
  { label: "Late", color: "#E11D48" },
];

type TimelineSegment = {
  kind: "work" | "break";
  leftPct: number;
  widthPct: number;
};

type BreakInterval = { started_at: string; ended_at: string };

function formatDateRangeLabel(start: Date, end: Date) {
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  return `${fmt(start)} - ${fmt(end)}`;
}

function formatHourMark(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}

function parseBreakIntervals(log: AttendanceLog | undefined): BreakInterval[] {
  if (!log?.break_intervals || !Array.isArray(log.break_intervals)) return [];
  return log.break_intervals.filter(
    (item): item is BreakInterval =>
      Boolean(item) &&
      typeof item.started_at === "string" &&
      typeof item.ended_at === "string"
  );
}

function sessionEndMs(log: AttendanceLog, nowMs: number) {
  if (log.clock_out_at) return new Date(log.clock_out_at).getTime();
  if (log.status === "clocked_in") return nowMs;
  return new Date(log.clock_in_at).getTime();
}

function buildTimelineWindow(log: AttendanceLog, nowMs: number) {
  const clockIn = new Date(log.clock_in_at);
  const defaultStart = new Date(clockIn);
  defaultStart.setHours(9, 0, 0, 0);
  const defaultEnd = new Date(clockIn);
  defaultEnd.setHours(17, 0, 0, 0);

  const sessionStart = clockIn.getTime();
  const sessionEnd = sessionEndMs(log, nowMs);
  const padMs = 30 * 60 * 1000;

  let startMs = Math.min(defaultStart.getTime(), sessionStart - padMs);
  let endMs = Math.max(defaultEnd.getTime(), sessionEnd + padMs);

  // Keep a usable span for very short sessions.
  if (endMs - startMs < 2 * 60 * 60 * 1000) {
    endMs = startMs + 2 * 60 * 60 * 1000;
  }

  return { startMs, endMs };
}

function buildTimelineMarks(startMs: number, endMs: number) {
  const span = endMs - startMs;
  const count = 6;
  return Array.from({ length: count }, (_, index) => {
    const at = startMs + (span * index) / (count - 1);
    return formatHourMark(new Date(at));
  });
}

function toPct(ms: number, startMs: number, endMs: number) {
  const span = endMs - startMs;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, ((ms - startMs) / span) * 100));
}

function buildTimelineSegments(
  log: AttendanceLog,
  startMs: number,
  endMs: number,
  nowMs: number
): TimelineSegment[] {
  const sessionStart = new Date(log.clock_in_at).getTime();
  const sessionEnd = sessionEndMs(log, nowMs);
  const intervals = parseBreakIntervals(log)
    .map((item) => ({
      start: new Date(item.started_at).getTime(),
      end: new Date(item.ended_at).getTime(),
    }))
    .filter((item) => !Number.isNaN(item.start) && !Number.isNaN(item.end) && item.end > item.start)
    .sort((a, b) => a.start - b.start);

  if (log.break_started_at) {
    const openStart = new Date(log.break_started_at).getTime();
    if (!Number.isNaN(openStart) && sessionEnd > openStart) {
      intervals.push({ start: openStart, end: sessionEnd });
    }
  }

  // Fallback when only total break seconds exist (no interval history yet).
  if (
    intervals.length === 0 &&
    !log.break_started_at &&
    Number(log.break_seconds ?? 0) > 0 &&
    sessionEnd > sessionStart
  ) {
    const breakMs = Math.min(
      Number(log.break_seconds) * 1000,
      Math.max(0, sessionEnd - sessionStart)
    );
    if (breakMs > 0) {
      intervals.push({ start: sessionEnd - breakMs, end: sessionEnd });
    }
  }

  const segments: TimelineSegment[] = [];
  let cursor = sessionStart;

  const pushSegment = (kind: "work" | "break", from: number, to: number) => {
    const left = toPct(from, startMs, endMs);
    const right = toPct(to, startMs, endMs);
    const width = right - left;
    if (width <= 0.15) return;
    segments.push({ kind, leftPct: left, widthPct: width });
  };

  for (const interval of intervals) {
    const breakStart = Math.max(interval.start, sessionStart);
    const breakEnd = Math.min(interval.end, sessionEnd);
    if (breakEnd <= breakStart) continue;
    if (breakStart > cursor) pushSegment("work", cursor, breakStart);
    pushSegment("break", breakStart, breakEnd);
    cursor = Math.max(cursor, breakEnd);
  }

  if (sessionEnd > cursor) pushSegment("work", cursor, sessionEnd);
  return segments;
}

function workedSeconds(log: AttendanceLog, nowMs: number) {
  if (log.total_seconds != null) return log.total_seconds;
  const start = new Date(log.clock_in_at).getTime();
  const end = sessionEndMs(log, nowMs);
  const elapsed = Math.max(0, Math.floor((end - start) / 1000));
  const completedBreak = Math.max(0, Number(log.break_seconds ?? 0) || 0);
  const openBreak = log.break_started_at
    ? Math.max(0, Math.floor((nowMs - new Date(log.break_started_at).getTime()) / 1000))
    : 0;
  return Math.max(0, elapsed - completedBreak - openBreak);
}

function TimesheetSectionHeader() {
  return (
    <div className="border-b border-[#E5E7EB] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center">
          <WorkerBrandedIcon src={WORKER_ICONS.timer} />
        </span>
        <span className={WORKER_SECTION_TITLE_CLASS} style={WORKER_SECTION_TITLE_STYLE}>
          My timesheets
        </span>
      </div>
    </div>
  );
}

export function ApplicantTimesheetsTab({ todayAttendance, recentAttendance }: Props) {
  const branding = useTenantBranding();
  const [rangeLabel] = useState("Last 7 days");
  const legend = useMemo(
    () => [{ label: "Work time", color: branding.primaryHex }, ...LEGEND_STATIC],
    [branding.primaryHex]
  );
  const logs = useMemo(() => {
    const merged = todayAttendance ? [todayAttendance, ...recentAttendance] : recentAttendance;
    const unique = new Map<string, AttendanceLog>();
    merged.forEach((log) => unique.set(log.id, log));
    return Array.from(unique.values()).slice(0, 7);
  }, [todayAttendance, recentAttendance]);

  const dateRangeLabel = useMemo(() => {
    if (logs.length === 0) {
      const today = new Date();
      return formatDateRangeLabel(today, today);
    }
    const dates = logs
      .map((log) => new Date(log.attendance_date))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length === 0) {
      const today = new Date();
      return formatDateRangeLabel(today, today);
    }
    return formatDateRangeLabel(dates[0], dates[dates.length - 1]);
  }, [logs]);

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} p-5`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
              Timesheets
            </h1>
            <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
              Manage Attendance &amp; Timesheets
            </p>
          </div>
          <div className="flex w-full items-center sm:w-auto">
            <button
              type="button"
              className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} flex-1 justify-between rounded-l-lg sm:flex-none sm:justify-start`}
              style={WORKER_TIMESHEET_FONT_STYLE}
            >
              {rangeLabel}
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
            </button>
            <button
              type="button"
              className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} flex-1 justify-between rounded-r-lg border-l-0 sm:flex-none sm:justify-start`}
              style={WORKER_TIMESHEET_FONT_STYLE}
            >
              <Calendar className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
              {dateRangeLabel}
            </button>
          </div>
        </div>

        <div className={WORKER_SCHEDULE_CARD_CLASS}>
          <TimesheetSectionHeader />

          <div className="px-4 py-4">
            <div className="flex flex-wrap items-center justify-center gap-6 py-3">
              {legend.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 ${WORKER_TIMESHEET_META_CLASS}`}
                  style={WORKER_TIMESHEET_FONT_STYLE}
                >
                  <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>

            <div className="mt-2">
              {logs.length === 0 ? (
                <TimesheetRow isPlaceholder workBarColor={branding.primaryHex} />
              ) : (
                logs.map((log, index) => (
                  <TimesheetRow
                    key={log.id}
                    log={log}
                    workBarColor={branding.primaryHex}
                    showDivider={index > 0}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimesheetRow({
  log,
  workBarColor,
  isPlaceholder = false,
  showDivider = false,
}: {
  log?: AttendanceLog;
  workBarColor: string;
  isPlaceholder?: boolean;
  showDivider?: boolean;
}) {
  const nowMs = Date.now();
  const clockIn = isPlaceholder ? { time: "---", meridiem: "" } : formatTimeParts(log?.clock_in_at);
  const clockOut = isPlaceholder ? { time: "---", meridiem: "" } : formatTimeParts(log?.clock_out_at);

  const durationLabel = isPlaceholder
    ? "0h"
    : formatDurationCompact(workedSeconds(log!, nowMs));

  const day = isPlaceholder || !log ? "Today" : dayLabel(log.attendance_date);
  const window = !isPlaceholder && log ? buildTimelineWindow(log, nowMs) : null;
  const marks = window
    ? buildTimelineMarks(window.startMs, window.endMs)
    : ["9:00", "11:00", "13:00", "15:00", "16:00", "17:00"];
  const segments =
    !isPlaceholder && log && window
      ? buildTimelineSegments(log, window.startMs, window.endMs, nowMs)
      : [];

  const clockInDisplay =
    clockIn.time === "—" || clockIn.time === "---"
      ? "---"
      : `${clockIn.time}${clockIn.meridiem ? ` ${clockIn.meridiem}` : ""}`.trim();
  const clockOutDisplay =
    clockOut.time === "—" || clockOut.time === "---"
      ? "---"
      : `${clockOut.time}${clockOut.meridiem ? ` ${clockOut.meridiem}` : ""}`.trim();

  return (
    <div
      className={`py-4 ${showDivider ? "border-t border-dashed border-[#E5E7EB]" : ""}`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className={WORKER_TIMESHEET_DAY_CLASS} style={WORKER_TIMESHEET_FONT_STYLE}>
          {day}
        </span>
        <span className={WORKER_TIMESHEET_DURATION_CLASS} style={WORKER_TIMESHEET_FONT_STYLE}>
          Duration:{" "}
          <span className={WORKER_TIMESHEET_VALUE_CLASS} style={WORKER_TIMESHEET_FONT_STYLE}>
            {durationLabel}
          </span>
        </span>
      </div>

      <div className="grid items-end gap-4 lg:grid-cols-[100px_minmax(0,1fr)_100px]">
        <div>
          <p className={WORKER_TIMESHEET_LABEL_CLASS} style={WORKER_TIMESHEET_FONT_STYLE}>
            Clock-in
          </p>
          <p className={`mt-1 ${WORKER_TIMESHEET_VALUE_CLASS}`} style={WORKER_TIMESHEET_FONT_STYLE}>
            {clockInDisplay}
          </p>
        </div>

        <div className="min-w-0 px-1">
          <div
            className={`mb-2 flex justify-between ${WORKER_TIMESHEET_META_CLASS}`}
            style={WORKER_TIMESHEET_FONT_STYLE}
          >
            {marks.map((mark, index) => (
              <span key={`${mark}-${index}`}>{mark}</span>
            ))}
          </div>
          <div className="relative h-[15px] overflow-hidden rounded bg-[#ECF1F9]">
            {segments.map((segment, index) => (
              <div
                key={`${segment.kind}-${index}`}
                className="absolute inset-y-0 rounded-sm"
                title={segment.kind === "break" ? "Break" : "Work time"}
                style={{
                  left: `${segment.leftPct}%`,
                  width: `${segment.widthPct}%`,
                  backgroundColor: segment.kind === "break" ? BREAK_COLOR : workBarColor,
                }}
              />
            ))}
          </div>
        </div>

        <div className="text-right lg:text-left">
          <p className={WORKER_TIMESHEET_LABEL_CLASS} style={WORKER_TIMESHEET_FONT_STYLE}>
            Clock-out
          </p>
          <p className={`mt-1 ${WORKER_TIMESHEET_VALUE_CLASS}`} style={WORKER_TIMESHEET_FONT_STYLE}>
            {clockOutDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}
