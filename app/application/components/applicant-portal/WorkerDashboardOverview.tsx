"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Megaphone,
  Palmtree,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import AnalyticsChartFrame from "@/app/components/charts/AnalyticsChartFrame";
import type {
  ApplicantNote,
  Appointment,
  AppointmentSlot,
  AttendanceLog,
} from "./types";
import {
  WORKER_CHART_BLUE,
  buildWeeklyScheduleRows,
  getAttendanceDaySummary,
  getAttendanceMonthOptions,
  getGreeting,
  getPtoBalancePlaceholders,
  mapNotesToAnnouncements,
} from "./worker-dashboard-utils";
import { WORKER_PORTAL_PAGE_PAD_CLASS } from "./worker-schedule-typography";

const SCHEDULE_HREF = "/application/applicant-dashboard/schedule?view=calendar";
const NOTES_HREF = "/application/applicant-dashboard/schedule?tab=notes";
const TIME_TRACKING_HREF = "/application/applicant-dashboard/schedule";
const HELP_HREF = "/application/applicant-dashboard/help";
const DOCUMENTS_HREF = "/application/applicant-dashboard/documents";

const CARD_CLASS = "w-full min-w-0 rounded-xl border border-[#E5E7EB] bg-white";
const VIEW_ALL_CLASS =
  "font-[Inter,sans-serif] text-[14px] font-medium leading-5 text-[#3B82F6] hover:underline";

const SCHEDULE_DATE_TONES = [
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FFEDD5", text: "#C2410C" },
  { bg: "#FEE2E2", text: "#B91C1C" },
  { bg: "#FEF9C3", text: "#A16207" },
  { bg: "#DCFCE7", text: "#15803D" },
] as const;

const QUICK_ACTIONS = [
  {
    id: "schedule",
    label: "View Schedule",
    subtitle: "See your upcoming shifts",
    href: SCHEDULE_HREF,
    iconBg: "#DBEAFE",
    iconColor: "#2563EB",
    Icon: CalendarDays,
  },
  {
    id: "clock",
    label: "Clock In / Out",
    subtitle: "Manage your attendance",
    href: TIME_TRACKING_HREF,
    iconBg: "#DCFCE7",
    iconColor: "#16A34A",
    Icon: Clock,
  },
  {
    id: "pto",
    label: "Request PTO",
    subtitle: "Apply for time off",
    href: HELP_HREF,
    iconBg: "#EDE9FE",
    iconColor: "#7C3AED",
    Icon: Palmtree,
  },
  {
    id: "documents",
    label: "My Documents",
    subtitle: "View your files",
    href: DOCUMENTS_HREF,
    iconBg: "#FFEDD5",
    iconColor: "#EA580C",
    Icon: FileText,
  },
] as const;

function WorkerCardShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD_CLASS} flex h-full flex-col`}>
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3.5 sm:px-5">
        <h2 className="min-w-0 truncate font-[Inter,sans-serif] text-[16px] font-semibold leading-6 text-[#111827]">
          {title}
        </h2>
        {action}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ScheduleStatusBadge({ hasShift }: { hasShift: boolean }) {
  if (!hasShift) {
    return (
      <span className="inline-flex rounded-full bg-[#F3F4F6] px-3 py-1 text-[12px] font-semibold text-[#6B7280]">
        No Shift
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[#D1FAE5] px-3 py-1 text-[12px] font-semibold text-[#047857]">
      Scheduled
    </span>
  );
}

function AttendanceDonut({ pct }: { pct: number }) {
  const safePct = Math.min(100, Math.max(0, pct));
  const isEmpty = safePct === 0;
  const data = isEmpty
    ? [{ key: "empty", value: 1 }]
    : [
        { key: "progress", value: safePct },
        { key: "remaining", value: Math.max(0, 100 - safePct) },
      ];

  return (
    <div className="flex flex-col items-center">
      <AnalyticsChartFrame className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center sm:h-[160px] sm:w-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              startAngle={90}
              endAngle={-270}
              stroke="#FFFFFF"
              strokeWidth={2}
            >
              {isEmpty ? (
                <Cell fill="#E5E7EB" />
              ) : (
                <>
                  <Cell fill={WORKER_CHART_BLUE} />
                  <Cell fill="#E5E7EB" />
                </>
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="font-[Inter,sans-serif] text-[28px] font-semibold leading-8 text-[#111827]">
            {safePct}%
          </span>
        </div>
      </AnalyticsChartFrame>
      <p className="mt-2 font-[Inter,sans-serif] text-[13px] font-medium leading-4 text-[#6B7280]">
        Attendance Rate
      </p>
    </div>
  );
}

type WorkerDashboardOverviewProps = {
  userName: string;
  appointment: Appointment | null;
  selectedSlot: AppointmentSlot | null;
  recentAttendance: AttendanceLog[];
  notes: ApplicantNote[];
  notesLoading: boolean;
};

export function WorkerDashboardOverview({
  userName,
  appointment,
  selectedSlot,
  recentAttendance,
  notes,
}: WorkerDashboardOverviewProps) {
  const monthOptions = useMemo(() => getAttendanceMonthOptions(), []);
  const [attendanceMonth, setAttendanceMonth] = useState(monthOptions[0]?.value ?? "");

  const scheduleRows = buildWeeklyScheduleRows(appointment, selectedSlot).slice(0, 5);
  const announcements = mapNotesToAnnouncements(notes);
  const attendanceSummary = getAttendanceDaySummary(
    recentAttendance,
    new Date(),
    attendanceMonth || undefined
  );
  const ptoItems = getPtoBalancePlaceholders();
  const displayName = userName.trim() || "there";

  return (
    <div className={`${WORKER_PORTAL_PAGE_PAD_CLASS} space-y-4`}>
      <header>
        <h1 className="font-[Inter,sans-serif] text-[20px] font-semibold leading-7 text-[#111827] max-[319px]:text-[18px] sm:text-[28px] sm:leading-9">
          {getGreeting()}, {displayName}!
        </h1>
        <p className="mt-1 font-[Inter,sans-serif] text-[14px] font-normal leading-5 text-[#6B7280] sm:text-[16px] sm:leading-6">
          Here&apos;s what&apos;s happening with your work today.
        </p>
      </header>

      <div className="grid w-full min-w-0 gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className={`${CARD_CLASS} flex min-h-[84px] items-center gap-3 px-4 py-3.5 transition hover:bg-[#F9FAFB]`}
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: action.iconBg, color: action.iconColor }}
              aria-hidden
            >
              <action.Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827]">
                {action.label}
              </span>
              <span className="mt-0.5 block font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                {action.subtitle}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="grid w-full min-w-0 items-stretch gap-3.5 lg:grid-cols-2">
        <WorkerCardShell
          title="Upcoming Schedule"
          action={
            <Link href={SCHEDULE_HREF} className={VIEW_ALL_CLASS}>
              View All
            </Link>
          }
        >
          <ul className="flex flex-1 flex-col gap-2.5">
            {scheduleRows.map((row, index) => {
              const tone = SCHEDULE_DATE_TONES[index % SCHEDULE_DATE_TONES.length];
              const hasShift = row.status !== "none";
              return (
                <li key={row.id} className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-[54px] w-[54px] shrink-0 flex-col items-center justify-center rounded-xl"
                    style={{ backgroundColor: tone.bg, color: tone.text }}
                  >
                    <span className="font-[Inter,sans-serif] text-[11px] font-semibold leading-3">
                      {row.weekdayLabel}
                    </span>
                    <span className="mt-0.5 font-[Inter,sans-serif] text-[12px] font-semibold leading-4">
                      {row.dateLabel.replace(/^([A-Za-z]+)\s/, "$1 ")}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827]">
                      {hasShift ? row.timeRange : "No shift scheduled"}
                    </p>
                    <p className="mt-0.5 truncate font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                      {hasShift ? row.location : "—"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <ScheduleStatusBadge hasShift={hasShift} />
                  </div>
                </li>
              );
            })}
          </ul>
        </WorkerCardShell>

        <WorkerCardShell
          title="Attendance Summary"
          action={
            <label className="relative inline-flex items-center">
              <span className="sr-only">Attendance month</span>
              <select
                value={attendanceMonth}
                onChange={(event) => setAttendanceMonth(event.target.value)}
                className="appearance-none rounded-lg border border-[#E5E7EB] bg-white py-1.5 pl-3 pr-8 font-[Inter,sans-serif] text-[13px] font-medium text-[#374151] outline-none focus:border-[#93C5FD]"
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-[#6B7280]"
                aria-hidden
              />
            </label>
          }
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row sm:justify-between">
            <AttendanceDonut pct={attendanceSummary.pct} />
            <dl className="grid w-full min-w-0 grid-cols-1 gap-4 sm:max-w-[200px]">
              <div>
                <dd className="font-[Inter,sans-serif] text-[22px] font-semibold leading-7 text-[#111827]">
                  {attendanceSummary.daysPresent} / {attendanceSummary.expectedDays || "—"}
                </dd>
                <dt className="mt-1 font-[Inter,sans-serif] text-[13px] leading-4 text-[#6B7280]">
                  Days Present
                </dt>
              </div>
              <div>
                <dd className="font-[Inter,sans-serif] text-[22px] font-semibold leading-7 text-[#111827]">
                  {attendanceSummary.daysLate}
                </dd>
                <dt className="mt-1 font-[Inter,sans-serif] text-[13px] leading-4 text-[#6B7280]">
                  Late
                </dt>
              </div>
              <div>
                <dd className="font-[Inter,sans-serif] text-[22px] font-semibold leading-7 text-[#111827]">
                  {attendanceSummary.daysAbsent}
                </dd>
                <dt className="mt-1 font-[Inter,sans-serif] text-[13px] leading-4 text-[#6B7280]">
                  Absent
                </dt>
              </div>
            </dl>
          </div>
        </WorkerCardShell>
      </div>

      <div className="grid w-full min-w-0 items-stretch gap-3.5 lg:grid-cols-2">
        <WorkerCardShell
          title="PTO Balance"
          action={
            <Link href={HELP_HREF} className={VIEW_ALL_CLASS}>
              View All
            </Link>
          }
        >
          <div className="flex flex-1 flex-col justify-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
              <span className="relative" aria-hidden>
                <CalendarDays className="h-6 w-6" strokeWidth={1.75} />
                <Palmtree className="absolute -bottom-1 -right-1 h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ptoItems.map((item) => (
                <div key={item.id} className="min-w-0">
                  <p className="font-[Inter,sans-serif] text-[28px] font-semibold leading-8 text-[#111827]">
                    {item.valueLabel}
                  </p>
                  <p className="mt-1 font-[Inter,sans-serif] text-[13px] leading-4 text-[#6B7280]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#9CA3AF]">
              PTO tracking coming soon
            </p>
          </div>
        </WorkerCardShell>

        <WorkerCardShell
          title="Company Announcement"
          action={
            <Link href={NOTES_HREF} className={VIEW_ALL_CLASS}>
              View All
            </Link>
          }
        >
          {announcements.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-sm text-[#6B7280]">
              No announcements yet.
            </p>
          ) : (
            <ul className="flex flex-1 flex-col gap-4">
              {announcements.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#2563EB]">
                    <Megaphone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827]">
                        {item.title}
                      </p>
                      <span className="shrink-0 font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                        {item.dateLabel}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </WorkerCardShell>
      </div>
    </div>
  );
}
