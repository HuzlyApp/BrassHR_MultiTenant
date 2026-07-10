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

const LEGEND_STATIC = [
  { label: "Break", color: "#0062FF" },
  { label: "Overtime", color: "#F59E0B" },
  { label: "Late", color: "#E11D48" },
];

const TIMELINE_MARKS = ["9:00", "11:00", "13:00", "15:00", "16:00", "17:00"];

function formatDateRangeLabel(start: Date, end: Date) {
  const fmt = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
  return `${fmt(start)} - ${fmt(end)}`;
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
          <div className="flex items-center">
            <button
              type="button"
              className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} rounded-l-lg`}
              style={WORKER_TIMESHEET_FONT_STYLE}
            >
              {rangeLabel}
              <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
            </button>
            <button
              type="button"
              className={`${WORKER_TIMESHEET_RANGE_CONTROL_CLASS} rounded-r-lg border-l-0`}
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
  const clockIn = isPlaceholder ? { time: "---", meridiem: "" } : formatTimeParts(log?.clock_in_at);
  const clockOut = isPlaceholder ? { time: "---", meridiem: "" } : formatTimeParts(log?.clock_out_at);

  const durationLabel = isPlaceholder
    ? "0h"
    : log!.total_seconds != null
      ? formatDurationCompact(log!.total_seconds)
      : log!.status === "clocked_in"
        ? formatDurationCompact(
            Math.max(0, Math.floor((Date.now() - new Date(log!.clock_in_at).getTime()) / 1000))
          )
        : "0h";

  const barWidth = isPlaceholder || !log ? 0 : computeBarWidth(log);
  const day = isPlaceholder || !log ? "Today" : dayLabel(log.attendance_date);

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
            {TIMELINE_MARKS.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
          <div className="relative h-[15px] rounded bg-[#ECF1F9]">
            {barWidth > 0 ? (
              <div
                className="absolute inset-y-0 left-0 rounded"
                style={{ width: `${barWidth}%`, backgroundColor: workBarColor }}
              />
            ) : null}
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

function computeBarWidth(log: AttendanceLog) {
  if (!log.clock_in_at) return 0;
  const dayStart = new Date(log.clock_in_at);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(log.clock_in_at);
  dayEnd.setHours(17, 0, 0, 0);
  const totalMs = dayEnd.getTime() - dayStart.getTime();
  if (totalMs <= 0) return 0;

  const endMs = log.clock_out_at
    ? new Date(log.clock_out_at).getTime()
    : log.status === "clocked_in"
      ? Date.now()
      : new Date(log.clock_in_at).getTime();
  const startMs = new Date(log.clock_in_at).getTime();
  const workedMs = Math.max(0, Math.min(endMs, dayEnd.getTime()) - Math.max(startMs, dayStart.getTime()));
  return Math.min(100, Math.round((workedMs / totalMs) * 100));
}
