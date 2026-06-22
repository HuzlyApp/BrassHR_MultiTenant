"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Clock, MapPin, Megaphone, Shield } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type {
  ApplicantNote,
  Appointment,
  AppointmentSlot,
  AttendanceLog,
} from "./types";
import {
  WORKER_CHART_BLUE,
  buildWeeklyScheduleRows,
  formatDecimalHours,
  getAttendanceProgress,
  getFirstName,
  getGreeting,
  getPayPeriodHours,
  getUpcomingShiftSummary,
  getWeekRangeLabel,
  getWeekShiftStats,
  mapNotesToAnnouncements,
} from "./worker-dashboard-utils";

const SCHEDULE_HREF = "/application/applicant-dashboard/schedule";
const NOTES_HREF = "/application/applicant-dashboard/schedule?tab=notes";
const TIMESHEETS_HREF = "/application/applicant-dashboard/schedule/timesheets";
const HELP_HREF = "/application/applicant-dashboard/help";

const WORKER_CARD_LABEL_CLASS =
  "font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#F97316]";

const WORKER_DASHBOARD_ICONS = {
  upcomingShift: "/icons/Upcoming-Shift.svg",
  schedule: "/icons/uil_schedule.svg",
  wallet: "/icons/uil_wallet.svg",
  leave: "/icons/mdi_island.svg",
  paySummary: "/icons/Pay-Summary-icon.svg",
} as const;

function WorkerDashboardIcon({ src, size }: { src: string; size: 24 | 64 }) {
  const sizeClass = size === 24 ? "h-6 w-6" : "h-16 w-16";
  return (
    <img src={src} alt="" width={size} height={size} className={sizeClass} aria-hidden />
  );
}

function WorkerCardShell({
  title,
  titleColor,
  action,
  centerBody = false,
  children,
}: {
  title: string;
  titleColor?: string;
  action?: ReactNode;
  centerBody?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`w-full min-w-0 rounded-md border border-[#E5E7EB] bg-white ${
        centerBody ? "flex h-full flex-col" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-[14px] py-[14px]">
        <h2
          className="font-[Inter,sans-serif] text-[16px] font-semibold leading-[24px]"
          style={{ color: titleColor ?? "#111827" }}
        >
          {title}
        </h2>
        {action}
      </div>
      <div className={`p-[14px] ${centerBody ? "flex flex-1 items-center" : ""}`}>{children}</div>
    </section>
  );
}

function WorkerOutlineButton({
  href,
  label,
  block = false,
}: {
  href: string;
  label: string;
  block?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#111827] transition hover:bg-[#F9FAFB] ${
        block ? "w-full" : "w-full sm:w-auto sm:min-w-[180px]"
      }`}
    >
      {label}
    </Link>
  );
}

function SummaryMetricCard({
  label,
  icon,
  iconBg,
  children,
  action,
}: {
  label: string;
  icon: ReactNode;
  iconBg: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[188px] w-full min-w-0 gap-3 rounded-md border border-[#E5E7EB] bg-white p-[14px] shadow-sm">
      <div className="flex min-w-0 flex-1 flex-col pt-4">
        <p className={WORKER_CARD_LABEL_CLASS}>{label}</p>
        <div className="mt-3 flex flex-1 flex-col justify-start gap-1">{children}</div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      <div className="flex shrink-0 items-start self-start">
        <div
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md p-1"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "confirmed" | "requested" | "rescheduled" | "none" }) {
  if (status === "none") {
    return (
      <span className="inline-flex rounded-md bg-[#F3F4F6] px-3 py-1 text-xs font-semibold text-[#6B7280]">
        No Shift
      </span>
    );
  }

  const label =
    status === "confirmed" ? "Confirmed" : status === "rescheduled" ? "Rescheduled" : "Requested";

  return (
    <span className="inline-flex rounded-md bg-[#CCFBF1] px-3 py-1 text-xs font-semibold text-[#0F766E]">
      {label}
    </span>
  );
}

function AttendanceDonut({ pct }: { pct: number }) {
  const data = [
    { key: "progress", value: pct },
    { key: "remaining", value: Math.max(0, 100 - pct) },
  ];

  return (
    <div className="relative flex h-[150px] w-full min-w-[140px] items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
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
            <Cell fill={WORKER_CHART_BLUE} />
            <Cell fill="#E5E7EB" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-[Inter,sans-serif] text-[24px] font-semibold leading-7 text-[#111827]">
          {pct}%
        </span>
        <span className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">of 40hrs</span>
      </div>
    </div>
  );
}

function AnnouncementIcon({ tone }: { tone: "green" | "red" | "yellow" }) {
  if (tone === "green") return <Megaphone className="h-[30px] w-[30px]" strokeWidth={1.75} />;
  if (tone === "red") return <Shield className="h-[30px] w-[30px]" strokeWidth={1.75} />;
  return <Clock className="h-[30px] w-[30px]" strokeWidth={1.75} />;
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
  notesLoading,
}: WorkerDashboardOverviewProps) {
  const upcoming = getUpcomingShiftSummary(appointment, selectedSlot);
  const weekStats = getWeekShiftStats(appointment, selectedSlot);
  const scheduleRows = buildWeeklyScheduleRows(appointment, selectedSlot);
  const announcements = mapNotesToAnnouncements(notes);
  const attendanceProgress = getAttendanceProgress(recentAttendance);
  const payPeriodHours = getPayPeriodHours(recentAttendance);
  const weekRange = getWeekRangeLabel();

  return (
    <div className="w-full min-w-0 space-y-[14px] px-4 py-5 min-[1000px]:px-8">
      <header className="space-y-1">
        <h1 className="font-[Inter,sans-serif] text-[30px] font-semibold leading-9 text-[#012352]">
          {getGreeting()}, {getFirstName(userName)}!
          <img
            src="/icons/clapping-hands.svg"
            alt=""
            width={18}
            height={18}
            className="ml-1 inline h-[18px] w-[18px] align-middle"
            aria-hidden
          />
        </h1>
        <p className="mt-1 font-[Inter,sans-serif] text-[16px] font-normal leading-6 text-[#6B7280]">
          Here&apos;s what happening with you schedule and work!
        </p>
      </header>

      <div className="grid w-full min-w-0 gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        <SummaryMetricCard
          label="Upcoming Shift"
          iconBg="#FFECD6"
          icon={<WorkerDashboardIcon src={WORKER_DASHBOARD_ICONS.upcomingShift} size={24} />}
          action={<WorkerOutlineButton href={SCHEDULE_HREF} label="View shift details" block />}
        >
          <p className="font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827]">
            {upcoming.dayLabel}
          </p>
          <p className="font-[Inter,sans-serif] text-[14px] leading-5 text-[#374151]">
            {upcoming.timeRange}
          </p>
          <p className="flex items-center gap-1 font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{upcoming.location}</span>
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          label="This Week"
          iconBg="#D6FFE6"
          icon={<WorkerDashboardIcon src={WORKER_DASHBOARD_ICONS.schedule} size={24} />}
        >
          <p className="font-[Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#111827]">
            {weekStats.shiftCount} {weekStats.shiftCount === 1 ? "Shift" : "Shifts"}
          </p>
          <p className="font-[Inter,sans-serif] text-[14px] leading-5 text-[#374151]">
            {formatDecimalHours(weekStats.scheduledHours)} Scheduled Hours
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          label="Pay this Period"
          iconBg="#DBEAFE"
          icon={<WorkerDashboardIcon src={WORKER_DASHBOARD_ICONS.wallet} size={24} />}
        >
          <p className="font-[Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#111827]">
            Soon
          </p>
          <p className="font-[Inter,sans-serif] text-[14px] leading-5 text-[#374151]">
            Pay tracking coming soon
          </p>
        </SummaryMetricCard>

        <SummaryMetricCard
          label="Leave Balance"
          iconBg="#CCFBF1"
          icon={<WorkerDashboardIcon src={WORKER_DASHBOARD_ICONS.leave} size={24} />}
          action={<WorkerOutlineButton href={HELP_HREF} label="Request Leave" block />}
        >
          <p className="font-[Inter,sans-serif] text-[24px] font-semibold leading-8 text-[#111827]">
            Soon
          </p>
          <p className="font-[Inter,sans-serif] text-[14px] leading-5 text-[#374151]">
            Leave tracking coming soon
          </p>
        </SummaryMetricCard>
      </div>

      <div className="grid w-full min-w-0 gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <WorkerCardShell
          title="My Schedule"
          action={
            <Link
              href={SCHEDULE_HREF}
              className="font-[Inter,sans-serif] text-[14px] font-medium leading-5 text-[#3B82F6] hover:underline"
            >
              View Calendar
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <tbody>
                {scheduleRows.map((row) => (
                  <tr key={row.id} className="border-b border-[#F3F4F6] text-sm">
                    <td className="py-3 pr-3 font-medium text-[#111827]">{row.dayLabel}</td>
                    <td className="py-3 pr-3 text-[#374151]">{row.timeRange}</td>
                    <td className="py-3 pr-3 text-[#374151]">{row.location}</td>
                    <td className="py-3 text-right">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex justify-center">
            <WorkerOutlineButton href={SCHEDULE_HREF} label="View Full Schedule" />
          </div>
        </WorkerCardShell>

        <WorkerCardShell
          title="Recent Announcements"
          action={
            <Link
              href={NOTES_HREF}
              className="font-[Inter,sans-serif] text-[14px] font-medium leading-5 text-[#3B82F6] hover:underline"
            >
              View All
            </Link>
          }
        >
          {notesLoading ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">Loading updates...</p>
          ) : announcements.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#6B7280]">No announcements yet.</p>
          ) : (
            <ul className="space-y-[14px]">
              {announcements.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <div
                    className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md p-1"
                    style={{ backgroundColor: item.iconBg, color: item.iconColor }}
                  >
                    <AnnouncementIcon tone={item.tone} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-[Inter,sans-serif] text-[14px] font-semibold leading-5 text-[#111827]">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-[12px] text-[#6B7280]">{item.dateLabel}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                      {item.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex justify-center">
            <WorkerOutlineButton href={NOTES_HREF} label="More Details" />
          </div>
        </WorkerCardShell>
      </div>

      <div className="grid w-full min-w-0 items-stretch gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr))]">
        <WorkerCardShell
          title="Time Attendance"
          centerBody
          action={
            <Link
              href={TIMESHEETS_HREF}
              className="font-[Inter,sans-serif] text-[14px] font-medium leading-5 text-[#3B82F6] hover:underline"
            >
              View Time Card
            </Link>
          }
        >
          <div className="grid w-full grid-cols-1 gap-[14px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(130px,160px)] lg:items-center">
            <div className="space-y-1 border-[#E5E7EB] lg:border-r lg:pr-[14px]">
              <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-4 text-[#6B7280]">
                This Week
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#9CA3AF]">{weekRange}</p>
              <p className="font-[Inter,sans-serif] text-[28px] font-semibold leading-8 text-[#111827]">
                {formatDecimalHours(attendanceProgress.weekHours)}
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">Hours Worked</p>
            </div>
            <div className="space-y-1 border-[#E5E7EB] lg:border-r lg:pr-[14px]">
              <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-4 text-[#6B7280]">
                Pay Period
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#9CA3AF]">{weekRange}</p>
              <p className="font-[Inter,sans-serif] text-[28px] font-semibold leading-8 text-[#111827]">
                {formatDecimalHours(payPeriodHours)}
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">Hours Worked</p>
            </div>
            <div className="relative flex items-center justify-center">
              <AttendanceDonut pct={attendanceProgress.pct} />
            </div>
          </div>
        </WorkerCardShell>

        <WorkerCardShell
          title="Pay Summary"
          centerBody
          action={
            <span className="font-[Inter,sans-serif] text-[14px] font-medium leading-5 text-[#9CA3AF]">
              View Payslips
            </span>
          }
        >
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-[Inter,sans-serif] text-[12px] font-semibold leading-4 text-[#6B7280]">
                Recent Pay
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#9CA3AF]">Coming soon</p>
              <p className="font-[Inter,sans-serif] text-[28px] font-semibold leading-8 text-[#111827]">
                —
              </p>
              <p className="font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">Net Pay</p>
              <p className="pt-2 font-[Inter,sans-serif] text-[12px] leading-4 text-[#6B7280]">
                Next pay day: Coming soon
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-center self-center sm:self-auto">
              <WorkerDashboardIcon src={WORKER_DASHBOARD_ICONS.paySummary} size={64} />
            </div>
          </div>
        </WorkerCardShell>
      </div>
    </div>
  );
}
