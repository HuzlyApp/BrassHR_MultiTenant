import { easternWallClockToDate } from "@/lib/datetime/eastern";
import { formatShiftRange } from "@/lib/scheduling/employee-schedule";

export type ClockInStatus = "On Shift" | "Not Clocked In" | "On Break" | "Completed";

export type ClockInScheduleShift = {
  id: string;
  workerId: string;
  candidateId: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  facilityName: string | null;
  departmentName: string | null;
  employeeName: string;
  email: string | null;
  jobRole: string | null;
  jobRequisitionId?: string | null;
};

export type ClockInAttendanceLog = {
  id: string;
  workerId: string;
  attendanceDate: string;
  status: "clocked_in" | "clocked_out";
  clockInAt: string;
  clockOutAt: string | null;
  totalSeconds: number | null;
  breakStartedAt: string | null;
  breakSeconds: number | null;
  clockInLatitude?: number | null;
  clockInLongitude?: number | null;
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
  claimedAt?: string | null;
  employeeName?: string | null;
  email?: string | null;
  jobRole?: string | null;
  jobRequisitionId?: string | null;
};

export type ClockInRow = {
  id: string;
  worker_id: string;
  attendance_log_id: string | null;
  applicant_name: string;
  applicant_email: string | null;
  job_role: string | null;
  job_requisition_id: string | null;
  facility_name: string | null;
  department_name: string | null;
  scheduled_shift: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_formatted: string;
  clock_out_formatted: string;
  total_seconds: number | null;
  hours_formatted: string;
  computed_status: ClockInStatus;
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_in_address?: string | null;
  clock_out_address?: string | null;
  claimed_at?: string | null;
  from_schedule: boolean;
};

export type ClockInMetrics = {
  clockedIn: number;
  notClockedIn: number;
  onBreak: number;
  totalScheduled: number;
};

const EASTERN_TIME_ZONE = "America/New_York";

export function formatClockInTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function attendanceStatus(log: ClockInAttendanceLog | null): ClockInStatus {
  if (!log) return "Not Clocked In";
  if (log.status === "clocked_out") return "Completed";
  if (log.breakStartedAt) return "On Break";
  return "On Shift";
}

export function workedSeconds(log: ClockInAttendanceLog | null, now: Date): number {
  if (!log) return 0;
  if (log.status === "clocked_out" && log.totalSeconds != null) {
    return Math.max(0, log.totalSeconds);
  }

  const start = new Date(log.clockInAt).getTime();
  if (Number.isNaN(start)) return Math.max(0, log.totalSeconds ?? 0);
  const end = log.clockOutAt ? new Date(log.clockOutAt).getTime() : now.getTime();
  if (Number.isNaN(end)) return Math.max(0, log.totalSeconds ?? 0);

  let seconds = Math.floor((end - start) / 1000) - (log.breakSeconds ?? 0);
  if (log.status === "clocked_in" && log.breakStartedAt) {
    const breakStart = new Date(log.breakStartedAt).getTime();
    if (!Number.isNaN(breakStart)) {
      seconds -= Math.max(0, Math.floor((now.getTime() - breakStart) / 1000));
    }
  }
  return Math.max(0, seconds);
}

function pairKey(personId: string, date: string): string {
  return `${personId}|${date}`;
}

function shiftStartMs(shift: ClockInScheduleShift): number {
  const [year, month, day] = shift.workDate.split("-").map(Number);
  const [hour, minute, second] = shift.startTime.split(":").map(Number);
  return easternWallClockToDate(year, month, day, hour || 0, minute || 0, second || 0).getTime();
}

/** Prefer the attendance log whose clock-in is closest to the shift start. */
export function takeClosestAttendanceLog(
  logs: ClockInAttendanceLog[],
  shift: ClockInScheduleShift
): ClockInAttendanceLog | undefined {
  if (logs.length === 0) return undefined;
  const target = shiftStartMs(shift);
  let bestIndex = 0;
  let bestDistance = Math.abs(new Date(logs[0].clockInAt).getTime() - target);
  for (let i = 1; i < logs.length; i += 1) {
    const distance = Math.abs(new Date(logs[i].clockInAt).getTime() - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return logs.splice(bestIndex, 1)[0];
}

function rowFromParts(
  id: string,
  workerId: string,
  name: string,
  email: string | null,
  jobRole: string | null,
  jobRequisitionId: string | null,
  facilityName: string | null,
  departmentName: string | null,
  scheduledShift: string | null,
  log: ClockInAttendanceLog | null,
  fromSchedule: boolean,
  now: Date
): ClockInRow {
  const seconds = workedSeconds(log, now);
  return {
    id,
    worker_id: workerId,
    attendance_log_id: log?.id ?? null,
    applicant_name: name.trim() || "Worker",
    applicant_email: email,
    job_role: jobRole,
    job_requisition_id: jobRequisitionId,
    facility_name: facilityName,
    department_name: departmentName,
    scheduled_shift: scheduledShift,
    clock_in_at: log?.clockInAt ?? "",
    clock_out_at: log?.clockOutAt ?? null,
    clock_in_formatted: formatClockInTime(log?.clockInAt),
    clock_out_formatted: formatClockInTime(log?.clockOutAt),
    total_seconds: log ? seconds : 0,
    hours_formatted: formatDurationSeconds(log ? seconds : 0),
    computed_status: attendanceStatus(log),
    clock_in_latitude: log?.clockInLatitude ?? undefined,
    clock_in_longitude: log?.clockInLongitude ?? undefined,
    clock_in_address: log?.clockInAddress ?? null,
    clock_out_address: log?.clockOutAddress ?? null,
    claimed_at: log?.claimedAt ?? null,
    from_schedule: fromSchedule,
  };
}

export function buildClockInRows(
  shifts: ClockInScheduleShift[],
  logs: ClockInAttendanceLog[],
  now = new Date()
): ClockInRow[] {
  const logsByPersonDate = new Map<string, ClockInAttendanceLog[]>();
  for (const log of [...logs].sort((a, b) => a.clockInAt.localeCompare(b.clockInAt))) {
    const key = pairKey(log.workerId, log.attendanceDate);
    const bucket = logsByPersonDate.get(key) ?? [];
    bucket.push(log);
    logsByPersonDate.set(key, bucket);
  }

  const rows: ClockInRow[] = [];
  const orderedShifts = [...shifts].sort((a, b) => {
    const byDate = a.workDate.localeCompare(b.workDate);
    if (byDate !== 0) return byDate;
    return a.startTime.localeCompare(b.startTime);
  });

  for (const shift of orderedShifts) {
    const key = shift.candidateId ? pairKey(shift.candidateId, shift.workDate) : "";
    const bucket = key ? logsByPersonDate.get(key) : undefined;
    const matched = bucket ? takeClosestAttendanceLog(bucket, shift) : undefined;
    if (key && bucket && bucket.length === 0) logsByPersonDate.delete(key);

    rows.push(
      rowFromParts(
        shift.id,
        shift.candidateId || shift.workerId,
        shift.employeeName,
        shift.email,
        shift.jobRole,
        shift.jobRequisitionId ?? null,
        shift.facilityName,
        shift.departmentName,
        formatShiftRange(shift.startTime, shift.endTime),
        matched ?? null,
        true,
        now
      )
    );
  }

  for (const remaining of logsByPersonDate.values()) {
    for (const log of remaining) {
      rows.push(
        rowFromParts(
          log.id,
          log.workerId,
          log.employeeName || "Worker",
          log.email ?? null,
          log.jobRole ?? null,
          log.jobRequisitionId ?? null,
          null,
          null,
          null,
          log,
          false,
          now
        )
      );
    }
  }

  return rows;
}

export function clockInMetrics(rows: ClockInRow[]): ClockInMetrics {
  let clockedIn = 0;
  let notClockedIn = 0;
  let onBreak = 0;
  let totalScheduled = 0;

  for (const row of rows) {
    if (row.from_schedule) totalScheduled += 1;
    if (row.computed_status === "On Shift") clockedIn += 1;
    else if (row.computed_status === "Not Clocked In") notClockedIn += 1;
    else if (row.computed_status === "On Break") onBreak += 1;
  }

  return { clockedIn, notClockedIn, onBreak, totalScheduled };
}
