"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlarmClock, Clock, Clock3, Link2, Pause, Play, Square } from "lucide-react";
import {
  formatDateOnly,
  formatDurationParts,
  formatDurationShort,
  formatScheduleDate,
  formatTimeParts,
  formatTimeRange,
  formatTimer,
  locationDisplay,
  meetingTypeLabel,
  scheduleStatusLabel,
} from "./format";
import type { Appointment, AppointmentSlot, AttendanceLog } from "./types";

type Props = {
  todayAttendance: AttendanceLog | null;
  recentAttendance: AttendanceLog[];
  appointment: Appointment | null;
  selectedSlot: AppointmentSlot | null;
  availableSlots: AppointmentSlot[];
  selectedSlotId: string;
  rescheduleReason: string;
  showRescheduleReason: boolean;
  requestingSchedule: boolean;
  requestingReschedule: boolean;
  attendanceSubmitting: boolean;
  onSelectedSlotIdChange: (value: string) => void;
  onRescheduleReasonChange: (value: string) => void;
  onShowRescheduleReasonChange: (value: boolean) => void;
  onRequestSchedule: (event: FormEvent<HTMLFormElement>) => void;
  onRequestReschedule: (event: FormEvent<HTMLFormElement>) => void;
  onAttendanceAction: (action: "clock_in" | "clock_out") => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[12px] leading-4">
      <span className="shrink-0 font-semibold text-[#374151]">{label}</span>
      <span className="min-w-0 text-[#374151]">{value}</span>
    </div>
  );
}

function TimeValue({ iso }: { iso: string | null | undefined }) {
  const { time, meridiem } = formatTimeParts(iso);
  if (time === "—") return <span className="text-[#94A3B8]">—</span>;
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span>{time}</span>
      {meridiem ? <span className="text-[#6B7280]">{meridiem}</span> : null}
    </span>
  );
}

function DurationValue({ seconds }: { seconds: number | null | undefined }) {
  const { hours, minutes } = formatDurationParts(seconds);
  if (seconds == null) return <span className="text-[#94A3B8]">—</span>;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-black">{hours}</span>
      <span className="text-[#6B7280]">hrs</span>
      <span className="text-black">{minutes}</span>
      <span className="text-[#6B7280]">mins</span>
    </span>
  );
}

export function ApplicantScheduleTab({
  todayAttendance,
  recentAttendance,
  appointment,
  selectedSlot,
  availableSlots,
  selectedSlotId,
  rescheduleReason,
  showRescheduleReason,
  requestingSchedule,
  requestingReschedule,
  attendanceSubmitting,
  onSelectedSlotIdChange,
  onRescheduleReasonChange,
  onShowRescheduleReasonChange,
  onRequestSchedule,
  onRequestReschedule,
  onAttendanceAction,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const isClockedIn = todayAttendance?.status === "clocked_in";
  const isCompleted = todayAttendance?.status === "clocked_out";

  useEffect(() => {
    if (!isClockedIn) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isClockedIn]);

  const timerSeconds = useMemo(() => {
    if (!todayAttendance?.clock_in_at) return 0;
    if (isCompleted && todayAttendance.total_seconds != null) return todayAttendance.total_seconds;
    if (isClockedIn) {
      const start = new Date(todayAttendance.clock_in_at).getTime();
      return Math.max(0, Math.floor((now - start) / 1000));
    }
    return 0;
  }, [todayAttendance, isClockedIn, isCompleted, now]);

  const timerLabel = isCompleted ? "COMPLETED" : isClockedIn ? "Working" : "Clocked in";
  const recentLog = recentAttendance[0] ?? todayAttendance;
  const scheduleDate = appointment?.confirmed_starts_at ?? selectedSlot?.starts_at ?? null;
  const scheduleEnd = appointment?.confirmed_ends_at ?? selectedSlot?.ends_at ?? null;
  const scheduleMeetingType = appointment?.meeting_type ?? selectedSlot?.meeting_type ?? null;
  const scheduleMeetingLink = appointment?.meeting_link ?? selectedSlot?.meeting_link ?? null;
  const scheduleLocation = appointment?.location ?? selectedSlot?.location ?? null;

  const upcomingAppointments = useMemo(() => {
    if (!appointment) return [];
    return [appointment];
  }, [appointment]);

  return (
    <div className="mx-8 mb-8 space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div>
        <h1 className="text-[30px] font-semibold leading-9 text-black">Schedules</h1>
        <p className="text-[16px] leading-6 text-[#6B7280]">Manage Schedules &amp; Appointments</p>
      </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
            <div className="border-b border-[#E5E7EB] px-3.5 py-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
                <AlarmClock className="h-5 w-5" />
                <span>{timerLabel}</span>
              </div>
            </div>
            <div className="flex flex-col items-center px-3.5 py-5">
              <p className="text-[14px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {isCompleted ? "Completed" : isClockedIn ? "In progress" : "Ready to start"}
              </p>
              <p className="mt-2 font-semibold tabular-nums text-[36px] leading-9 text-black">
                {todayAttendance ? formatTimer(timerSeconds) : "--:--:--"}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled
                  className="inline-flex h-7 items-center gap-1.5 rounded border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 text-[12px] font-semibold text-[#475569] opacity-60"
                >
                  <Pause className="h-4 w-4" />
                  Break
                </button>
                {isClockedIn ? (
                  <button
                    type="button"
                    disabled={attendanceSubmitting}
                    onClick={() => onAttendanceAction("clock_out")}
                    className="inline-flex h-7 items-center gap-1.5 rounded bg-[#BC8B41] px-2.5 text-[12px] font-semibold text-white transition hover:bg-[#a67a38] disabled:opacity-60"
                  >
                    <Square className="h-4 w-4" />
                    {attendanceSubmitting ? "Saving..." : "Clock Out"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={attendanceSubmitting || isCompleted}
                    onClick={() => onAttendanceAction("clock_in")}
                    className="inline-flex h-7 items-center gap-1.5 rounded bg-[#BC8B41] px-2.5 text-[12px] font-semibold text-white transition hover:bg-[#a67a38] disabled:opacity-60"
                  >
                    <Play className="h-4 w-4" />
                    {attendanceSubmitting ? "Verifying..." : "Start"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <ClockCard
            title="Clock In"
            icon={<Clock className="h-5 w-5" />}
            timeIso={todayAttendance?.clock_in_at}
            totalSeconds={todayAttendance?.clock_in_at && isCompleted ? todayAttendance.total_seconds : null}
            ip={todayAttendance?.clock_in_ip}
            location={locationDisplay(
              todayAttendance?.clock_in_address,
              todayAttendance?.clock_in_latitude,
              todayAttendance?.clock_in_longitude
            )}
          />

          <ClockCard
            title="Clock Out"
            icon={<Clock3 className="h-5 w-5" />}
            timeIso={todayAttendance?.clock_out_at}
            totalSeconds={isCompleted ? todayAttendance?.total_seconds : null}
            ip={todayAttendance?.clock_out_ip}
            location={locationDisplay(
              todayAttendance?.clock_out_address,
              todayAttendance?.clock_out_latitude,
              todayAttendance?.clock_out_longitude
            )}
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[#E5E7EB] px-2 py-1">
          <div className="grid grid-cols-3 gap-2 border-b border-[#E5E7EB] px-3 py-2 text-[10px] font-semibold uppercase text-black">
            <span>Date/time</span>
            <span>Status</span>
            <span>Total</span>
          </div>
          {recentLog ? (
            <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[12px] text-[#374151]">
              <div className="flex items-center gap-1">
                <span>{formatDateOnly(recentLog.clock_out_at ?? recentLog.clock_in_at)}</span>
                <span>•</span>
                <TimeValue iso={recentLog.clock_out_at ?? recentLog.clock_in_at} />
              </div>
              <div>
                <span className="inline-flex rounded border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-1 text-[12px] font-semibold">
                  {recentLog.status === "clocked_in" ? "Clocked in" : "Clocked out"}
                </span>
              </div>
              <DurationValue seconds={recentLog.total_seconds} />
            </div>
          ) : (
            <p className="px-3 py-4 text-[13px] text-[#64748B]">No attendance records yet.</p>
          )}
        </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-3.5 py-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
            <AlarmClock className="h-5 w-5" />
            Schedules
          </div>
        </div>

        <ScheduleTableSection title="Today">
          {appointment && scheduleDate ? (
            <ScheduleRow
              date={formatDateOnly(scheduleDate)}
              time={formatTimeRange(scheduleDate, scheduleEnd)}
              address={scheduleLocation ?? meetingTypeLabel(scheduleMeetingType)}
              position={scheduleStatusLabel(appointment.status)}
              manager="Recruiter"
            />
          ) : (
            <EmptyScheduleRow message="No shift scheduled for today." />
          )}
        </ScheduleTableSection>

        <div className="mx-3.5 border-t border-[#E5E7EB]" />

        <ScheduleTableSection title="Upcoming">
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((item) => {
              const starts = item.confirmed_starts_at ?? selectedSlot?.starts_at;
              const ends = item.confirmed_ends_at ?? selectedSlot?.ends_at;
              return (
                <ScheduleRow
                  key={item.id}
                  date={formatDateOnly(starts)}
                  time={formatTimeRange(starts, ends)}
                  address={item.location ?? meetingTypeLabel(item.meeting_type)}
                  position={scheduleStatusLabel(item.status)}
                  manager="Recruiter"
                />
              );
            })
          ) : (
            <EmptyScheduleRow message="No upcoming schedules." />
          )}
        </ScheduleTableSection>

        <div className="border-t border-[#E5E7EB] px-3.5 py-4">
          <form onSubmit={onRequestSchedule} className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedSlotId}
              onChange={(event) => onSelectedSlotIdChange(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#012352] outline-none focus:border-[#BC8B41]"
            >
              <option value="">
                {availableSlots.length > 0 ? "Choose an available time slot" : "No available time slots"}
              </option>
              {availableSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatScheduleDate(slot.starts_at)} - {meetingTypeLabel(slot.meeting_type)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedSlotId || requestingSchedule}
              className="inline-flex h-10 min-w-[140px] items-center justify-center rounded-lg bg-[#BC8B41] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {requestingSchedule ? "Requesting..." : "Request Schedule"}
            </button>
          </form>

          {appointment && appointment.status !== "cancelled" ? (
            <div className="mt-3">
              {!showRescheduleReason ? (
                <button
                  type="button"
                  onClick={() => onShowRescheduleReasonChange(true)}
                  className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] px-4 text-[13px] font-semibold text-[#475569]"
                >
                  Request Reschedule
                </button>
              ) : (
                <form onSubmit={onRequestReschedule} className="space-y-3">
                  <textarea
                    value={rescheduleReason}
                    onChange={(event) => onRescheduleReasonChange(event.target.value)}
                    placeholder="Add a short reason for requesting a new schedule."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none focus:border-[#BC8B41]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onShowRescheduleReasonChange(false);
                        onRescheduleReasonChange("");
                      }}
                      className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] px-4 text-[13px] font-semibold text-[#64748B]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!rescheduleReason.trim() || requestingReschedule}
                      className="inline-flex h-9 items-center rounded-lg bg-[#BC8B41] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                    >
                      {requestingReschedule ? "Sending..." : "Request Reschedule"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-3.5 py-3">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
            <AlarmClock className="h-5 w-5" />
            Appointments / Interviews
          </div>
        </div>

        <ScheduleTableSection title="Upcoming">
          {appointment ? (
            <div className="grid grid-cols-[120px_120px_1fr_1fr_150px_100px] gap-2 px-3 py-2.5 text-[12px] text-[#374151]">
              <span>{formatDateOnly(scheduleDate)}</span>
              <span>{formatTimeRange(scheduleDate, scheduleEnd)}</span>
              <span>{scheduleLocation ?? meetingTypeLabel(scheduleMeetingType)}</span>
              <span className="inline-flex items-center gap-1 truncate">
                {scheduleMeetingLink ? (
                  <>
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-[#BC8B41]" />
                    <a
                      href={scheduleMeetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[#BC8B41] underline-offset-2 hover:underline"
                    >
                      {scheduleMeetingLink}
                    </a>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span>HR Manager</span>
              <span className="text-right">
                <span className="inline-flex rounded-lg border border-[#E2E8F0] px-2 py-1 text-[10px] font-semibold text-[#475569]">
                  Details
                </span>
              </span>
            </div>
          ) : (
            <EmptyScheduleRow message="No appointments scheduled." />
          )}
        </ScheduleTableSection>
      </div>
    </div>
  );
}

function ClockCard({
  title,
  icon,
  timeIso,
  totalSeconds,
  ip,
  location,
}: {
  title: string;
  icon: React.ReactNode;
  timeIso?: string | null;
  totalSeconds?: number | null;
  ip?: string | null;
  location?: string;
}) {
  const date = formatDateOnly(timeIso);
  const hasData = Boolean(timeIso);

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
      <div className="border-b border-[#E5E7EB] px-3.5 py-3">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-black">
          {icon}
          {title}
        </div>
      </div>
      <div className="space-y-3 p-3.5 text-[12px]">
        <DetailRow
          label={`${title.toLowerCase()} time:`}
          value={
            hasData ? (
              <>
                {date} <span className="text-[#374151]">•</span> <TimeValue iso={timeIso} />
              </>
            ) : (
              <span className="text-[#94A3B8]">—</span>
            )
          }
        />
        <DetailRow
          label="Total hours:"
          value={hasData ? <DurationValue seconds={totalSeconds} /> : <span className="text-[#94A3B8]">—</span>}
        />
        <DetailRow
          label="IP Address:"
          value={ip ?? <span className="text-[#94A3B8]">—</span>}
        />
        <DetailRow
          label="Location:"
          value={
            <span className={hasData ? "text-[#6B7280]" : "text-[#94A3B8]"}>{location ?? "—"}</span>
          }
        />
      </div>
    </div>
  );
}

function ScheduleTableSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-3.5 py-2.5">
      <p className="px-3 py-2 text-[14px] font-semibold text-black">{title}</p>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[120px_120px_1fr_150px_150px_100px] gap-2 px-3 py-1 text-[10px] font-semibold uppercase text-black">
            <span>Date</span>
            <span>Time</span>
            <span>Address</span>
            <span>Position</span>
            <span>Manager</span>
            <span />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({
  date,
  time,
  address,
  position,
  manager,
}: {
  date: string;
  time: string;
  address: string;
  position: string;
  manager: string;
}) {
  return (
    <div className="grid grid-cols-[120px_120px_1fr_150px_150px_100px] gap-2 border-t border-[#F1F5F9] px-3 py-2.5 text-[12px] text-[#374151]">
      <span>{date}</span>
      <span>{time}</span>
      <span className="truncate text-[#4B5563]">{address}</span>
      <span>{position}</span>
      <span>{manager}</span>
      <span className="text-right">
        <span className="inline-flex rounded-lg border border-[#E2E8F0] px-2 py-1 text-[10px] font-semibold text-[#475569]">
          Details
        </span>
      </span>
    </div>
  );
}

function EmptyScheduleRow({ message }: { message: string }) {
  return <p className="border-t border-[#F1F5F9] px-3 py-4 text-[13px] text-[#64748B]">{message}</p>;
}
