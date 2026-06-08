"use client";

import { useMemo, useState } from "react";
import { AlarmClock, Calendar, ChevronDown } from "lucide-react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { dayLabel, formatDurationShort, formatTimeParts, formatTimer } from "./format";
import type { AttendanceLog } from "./types";

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

  return (
    <div className="mx-8 mb-8 rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold leading-9 text-black">Timesheets</h1>
            <p className="text-[16px] leading-6 text-[#6B7280]">Manage Attendance &amp; Timehsheets</p>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-l-lg border border-[#E5E7EB] bg-white px-2 text-[12px] text-[#374151]"
            >
              {rangeLabel}
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-r-lg border border-l-0 border-[#E5E7EB] bg-white px-2 text-[12px] text-[#374151]"
            >
              <Calendar className="h-4 w-4" />
              Feb 04 - Feb 04
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
          <div className="border-b border-[#E5E7EB] px-3.5 py-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
              <AlarmClock className="h-5 w-5" />
              My timesheets
            </div>
          </div>

          <div className="space-y-4 px-3.5 py-4">
            <div className="flex flex-wrap items-center justify-center gap-6 px-2 py-3">
              {legend.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-[12px] text-[#374151]">
                  <span className="h-3 w-3 rounded-[2px]" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>

            {logs.length === 0 ? (
              <p className="rounded-lg bg-[#F8FAFC] px-4 py-6 text-center text-[14px] text-[#64748B]">
                No timesheet entries yet. Clock in from the Schedule tab to start tracking time.
              </p>
            ) : (
              logs.map((log) => <TimesheetRow key={log.id} log={log} workBarColor={branding.primaryHex} />)
            )}
          </div>
        </div>
    </div>
  );
}

function TimesheetRow({ log, workBarColor }: { log: AttendanceLog; workBarColor: string }) {
  const clockIn = formatTimeParts(log.clock_in_at);
  const clockOut = formatTimeParts(log.clock_out_at);
  const durationLabel =
    log.total_seconds != null
      ? formatDurationShort(log.total_seconds)
      : log.status === "clocked_in"
        ? formatTimer(
            Math.max(0, Math.floor((Date.now() - new Date(log.clock_in_at).getTime()) / 1000))
          )
        : "0h";

  const barWidth = computeBarWidth(log);

  return (
    <div className="space-y-3 border-t border-[#F1F5F9] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between text-[14px]">
        <span className="font-semibold text-black">{dayLabel(log.attendance_date)}</span>
        <span className="text-[#6B7280]">
          Duration: <span className="font-normal text-black">{durationLabel}</span>
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[120px_1fr_72px]">
        <div className="text-[12px]">
          <p className="text-[#6B7280]">Clock-in</p>
          <p className="mt-1 text-black">
            {clockIn.time} {clockIn.meridiem}
          </p>
        </div>

        <div className="min-w-0 px-2">
          <div className="mb-2 flex justify-between text-[12px] text-[#6B7280]">
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

        <div className="text-[12px]">
          <p className="text-[#6B7280]">Clock-out</p>
          <p className="mt-1 text-black">
            {clockOut.time === "—" ? "—" : `${clockOut.time} ${clockOut.meridiem}`.trim()}
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
