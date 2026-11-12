"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, Download } from "lucide-react";
import { WorkerBrandedIcon } from "./WorkerBrandedIcon";
import { WORKER_ICONS } from "./worker-icons";
import { useApplicantPortal } from "./ApplicantPortalProvider";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  addEasternDays,
  easternDateString,
  easternWallClockToDate,
  getEasternParts,
  startOfEasternDay,
} from "@/lib/datetime/eastern";
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

type RangePreset = "weekly" | "biweekly" | "monthly" | "custom";

const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "weekly", label: "Last 7 days" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

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
    date.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "2-digit",
    });
  return `${fmt(start)} - ${fmt(end)}`;
}

function toIsoDateInput(date: Date) {
  return easternDateString(date);
}

function parseIsoDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return easternWallClockToDate(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0, 0);
}

function resolvePresetRange(
  preset: RangePreset,
  customStart: string,
  customEnd: string,
  now = new Date()
): { start: Date; end: Date; label: string } {
  const today = startOfEasternDay(now);

  if (preset === "weekly") {
    const start = addEasternDays(today, -6);
    return { start, end: today, label: "Last 7 days" };
  }

  if (preset === "biweekly") {
    const start = addEasternDays(today, -13);
    return { start, end: today, label: "Bi-weekly" };
  }

  if (preset === "monthly") {
    const parts = getEasternParts(now);
    const start = easternWallClockToDate(parts.year, parts.month, 1, 0, 0, 0);
    return { start, end: today, label: "Monthly" };
  }

  const parsedStart = parseIsoDateInput(customStart) ?? addEasternDays(today, -6);
  const parsedEnd = parseIsoDateInput(customEnd) ?? today;
  const start = parsedStart.getTime() <= parsedEnd.getTime() ? parsedStart : parsedEnd;
  const end = parsedStart.getTime() <= parsedEnd.getTime() ? parsedEnd : parsedStart;
  return { start, end, label: "Custom" };
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatExportTime(iso: string | null | undefined) {
  const parts = formatTimeParts(iso);
  if (parts.time === "—") return "";
  return `${parts.time}${parts.meridiem ? ` ${parts.meridiem}` : ""}`.trim();
}

function formatHourMark(date: Date) {
  return date.toLocaleTimeString("en-US", { timeZone: "America/New_York", 
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
  const { authHeaders } = useApplicantPortal();
  const todayIso = useMemo(() => toIsoDateInput(new Date()), []);
  const defaultWeeklyStart = useMemo(
    () => toIsoDateInput(addEasternDays(startOfEasternDay(new Date()), -6)),
    []
  );

  const [preset, setPreset] = useState<RangePreset>("weekly");
  const [customStart, setCustomStart] = useState(defaultWeeklyStart);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [logs, setLogs] = useState<AttendanceLog[]>(() => {
    const merged = todayAttendance ? [todayAttendance, ...recentAttendance] : recentAttendance;
    const unique = new Map<string, AttendanceLog>();
    merged.forEach((log) => unique.set(log.id, log));
    return Array.from(unique.values());
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(
    () => resolvePresetRange(preset, customStart, customEnd),
    [preset, customStart, customEnd]
  );
  const startIso = toIsoDateInput(range.start);
  const endIso = toIsoDateInput(range.end);
  const dateRangeLabel = formatDateRangeLabel(range.start, range.end);
  const presetLabel =
    RANGE_PRESETS.find((option) => option.value === preset)?.label ?? range.label;

  const legend = useMemo(
    () => [{ label: "Work time", color: branding.primaryHex }, ...LEGEND_STATIC],
    [branding.primaryHex]
  );

  const loadTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error("You need to sign in again.");

      const qs = new URLSearchParams({ start: startIso, end: endIso });
      const res = await fetch(`/api/applicant-portal/attendance?${qs.toString()}`, {
        headers,
        cache: "no-store",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        recent?: AttendanceLog[];
        today?: AttendanceLog | null;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not load timesheets.");

      const merged = payload.today ? [payload.today, ...(payload.recent ?? [])] : payload.recent ?? [];
      const unique = new Map<string, AttendanceLog>();
      for (const log of merged) {
        if (log.attendance_date < startIso || log.attendance_date > endIso) continue;
        unique.set(log.id, log);
      }
      setLogs(
        Array.from(unique.values()).sort((a, b) =>
          b.attendance_date.localeCompare(a.attendance_date)
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load timesheets.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, endIso, startIso]);

  useEffect(() => {
    void loadTimesheets();
  }, [loadTimesheets]);

  function handlePresetChange(next: RangePreset) {
    setPreset(next);
    if (next === "custom") {
      setCustomStart(startIso);
      setCustomEnd(endIso);
    }
  }

  function handleExport() {
    const nowMs = Date.now();
    const rows = [
      ["Date", "Clock-in", "Clock-out", "Duration", "Break (minutes)", "Status"].join(","),
      ...logs.map((log) => {
        const breakMinutes = Math.round(Math.max(0, Number(log.break_seconds ?? 0) || 0) / 60);
        return [
          csvEscape(dayLabel(log.attendance_date)),
          csvEscape(formatExportTime(log.clock_in_at)),
          csvEscape(formatExportTime(log.clock_out_at)),
          csvEscape(formatDurationCompact(workedSeconds(log, nowMs))),
          String(breakMinutes),
          csvEscape(log.status === "clocked_in" ? "Clocked in" : "Clocked out"),
        ].join(",");
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `timesheets-${startIso}-to-${endIso}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} pb-8`}>
      <div className={`${WORKER_SCHEDULE_CARD_CLASS} p-5`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={WORKER_SCHEDULE_TITLE_CLASS} style={WORKER_SCHEDULE_TITLE_STYLE}>
              Timesheets
            </h1>
            <p className={WORKER_SCHEDULE_SUBTITLE_CLASS} style={WORKER_SCHEDULE_SUBTITLE_STYLE}>
              View and manage your timesheet records.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <div className="flex min-w-0 flex-1 items-center sm:flex-none">
                <label className="relative min-w-0 flex-1 sm:flex-none">
                  <span className="sr-only">Timesheet range</span>
                  <select
                    value={preset}
                    onChange={(event) => handlePresetChange(event.target.value as RangePreset)}
                    className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} w-full appearance-none justify-between rounded-l-lg pr-9 sm:w-[160px]`}
                    style={WORKER_TIMESHEET_FONT_STYLE}
                  >
                    {RANGE_PRESETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                    aria-hidden
                  />
                </label>
                {preset === "custom" ? (
                  <div
                    className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} flex-1 gap-2 rounded-r-lg border-l-0 sm:flex-none`}
                    style={WORKER_TIMESHEET_FONT_STYLE}
                  >
                    <Calendar className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
                    <input
                      type="date"
                      value={customStart}
                      max={customEnd}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className="min-w-0 border-0 bg-transparent p-0 text-[13px] text-[#374151] outline-none"
                      aria-label="Custom start date"
                    />
                    <span className="text-[#94A3B8]">–</span>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      max={todayIso}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className="min-w-0 border-0 bg-transparent p-0 text-[13px] text-[#374151] outline-none"
                      aria-label="Custom end date"
                    />
                  </div>
                ) : (
                  <div
                    className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} flex-1 justify-between rounded-r-lg border-l-0 sm:flex-none sm:justify-start`}
                    style={WORKER_TIMESHEET_FONT_STYLE}
                    aria-label={`${presetLabel}: ${dateRangeLabel}`}
                  >
                    <Calendar className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
                    {dateRangeLabel}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={logs.length === 0 || loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 text-[14px] font-semibold text-[#374151] transition hover:bg-[#F8FAFC] disabled:opacity-50"
                style={WORKER_SECTION_TITLE_STYLE}
              >
                <Download className="h-4 w-4" aria-hidden />
                Export
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

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
              {loading ? (
                <div className="py-10 text-center text-[14px] text-[#64748B]" style={WORKER_TIMESHEET_FONT_STYLE}>
                  Loading timesheets…
                </div>
              ) : logs.length === 0 ? (
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
