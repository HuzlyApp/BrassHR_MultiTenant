import type { SupabaseClient } from "@supabase/supabase-js";
import { easternDateString, easternTimeString } from "@/lib/datetime/eastern";

const DAILY_REGULAR_MINUTES = 8 * 60;

type AttendanceSession = {
  status: "clocked_in" | "clocked_out";
  clock_in_at: string;
  clock_out_at: string | null;
  total_seconds: number | null;
  break_seconds: number | null;
  break_started_at: string | null;
};

type EmploymentWorker = {
  id: string;
  tenant_id: string;
};

type ScheduleShift = {
  facility_id: string | null;
  department_id: string | null;
  start_time: string;
};

function clampMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1440, Math.round(value));
}

function sessionWorkedSeconds(session: AttendanceSession, now: Date): number {
  if (session.status === "clocked_out" && session.total_seconds != null) {
    return Math.max(0, session.total_seconds);
  }

  const start = new Date(session.clock_in_at).getTime();
  if (Number.isNaN(start)) return Math.max(0, session.total_seconds ?? 0);

  const end = session.clock_out_at ? new Date(session.clock_out_at).getTime() : now.getTime();
  if (Number.isNaN(end)) return Math.max(0, session.total_seconds ?? 0);

  let seconds = Math.floor((end - start) / 1000) - Math.max(0, session.break_seconds ?? 0);
  if (session.status === "clocked_in" && session.break_started_at) {
    const breakStart = new Date(session.break_started_at).getTime();
    if (!Number.isNaN(breakStart)) {
      seconds -= Math.max(0, Math.floor((now.getTime() - breakStart) / 1000));
    }
  }
  return Math.max(0, seconds);
}

function sessionBreakSeconds(session: AttendanceSession, now: Date): number {
  let seconds = Math.max(0, session.break_seconds ?? 0);
  if (session.status === "clocked_in" && session.break_started_at) {
    const breakStart = new Date(session.break_started_at).getTime();
    if (!Number.isNaN(breakStart)) {
      seconds += Math.max(0, Math.floor((now.getTime() - breakStart) / 1000));
    }
  }
  return seconds;
}

export function splitRegularAndOvertimeMinutes(workedMinutes: number): {
  regular_minutes: number;
  overtime_minutes: number;
} {
  const total = clampMinutes(workedMinutes);
  const regular_minutes = Math.min(DAILY_REGULAR_MINUTES, total);
  const overtime_minutes = Math.max(0, total - regular_minutes);
  return { regular_minutes, overtime_minutes };
}

/**
 * Upserts a daily employee_timesheet_entries row from applicant attendance logs
 * so Admin Timesheets reflects worker clock-in/out.
 */
export async function syncAttendanceDayToTimesheet(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    applicantWorkerId: string;
    attendanceDate?: string;
    now?: Date;
  }
): Promise<{ synced: boolean; reason?: string }> {
  const now = input.now ?? new Date();
  const attendanceDate = input.attendanceDate ?? easternDateString(now);

  const { data: employment, error: employmentError } = await supabase
    .from("workers")
    .select("id, tenant_id")
    .eq("candidate_id", input.applicantWorkerId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (employmentError) throw employmentError;

  const employee = employment as EmploymentWorker | null;
  if (!employee?.id) {
    return { synced: false, reason: "No hired employee record linked to this applicant." };
  }

  const { data: logData, error: logError } = await supabase
    .from("applicant_attendance_logs")
    .select("status, clock_in_at, clock_out_at, total_seconds, break_seconds, break_started_at")
    .eq("tenant_id", input.tenantId)
    .eq("worker_id", input.applicantWorkerId)
    .eq("attendance_date", attendanceDate)
    .order("clock_in_at", { ascending: true });
  if (logError) throw logError;

  const sessions = (logData ?? []) as AttendanceSession[];
  if (sessions.length === 0) {
    return { synced: false, reason: "No attendance sessions for this date." };
  }

  const { data: shiftData, error: shiftError } = await supabase
    .from("employee_schedule_shifts")
    .select("facility_id, department_id, start_time")
    .eq("tenant_id", input.tenantId)
    .eq("worker_id", employee.id)
    .eq("work_date", attendanceDate)
    .order("start_time", { ascending: true })
    .limit(1);
  if (shiftError) throw shiftError;

  const shift = ((shiftData ?? [])[0] as ScheduleShift | undefined) ?? null;

  let workedSeconds = 0;
  let breakSeconds = 0;
  let earliestIn: Date | null = null;
  let latestOut: Date | null = null;
  let hasOpenSession = false;

  for (const session of sessions) {
    workedSeconds += sessionWorkedSeconds(session, now);
    breakSeconds += sessionBreakSeconds(session, now);

    const clockIn = new Date(session.clock_in_at);
    if (!Number.isNaN(clockIn.getTime())) {
      if (!earliestIn || clockIn < earliestIn) earliestIn = clockIn;
    }

    if (session.status === "clocked_in" || !session.clock_out_at) {
      hasOpenSession = true;
      continue;
    }

    const clockOut = new Date(session.clock_out_at);
    if (!Number.isNaN(clockOut.getTime())) {
      if (!latestOut || clockOut > latestOut) latestOut = clockOut;
    }
  }

  const workedMinutes = clampMinutes(workedSeconds / 60);
  const breakMinutes = clampMinutes(breakSeconds / 60);
  const { regular_minutes, overtime_minutes } = splitRegularAndOvertimeMinutes(workedMinutes);

  const payload = {
    tenant_id: input.tenantId,
    worker_id: employee.id,
    facility_id: shift?.facility_id ?? null,
    department_id: shift?.department_id ?? null,
    work_date: attendanceDate,
    regular_minutes,
    overtime_minutes,
    break_minutes: breakMinutes,
    clock_in: earliestIn ? easternTimeString(earliestIn) : null,
    clock_out: hasOpenSession || !latestOut ? null : easternTimeString(latestOut),
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await supabase.from("employee_timesheet_entries").upsert(payload, {
    onConflict: "worker_id,work_date",
  });
  if (upsertError) throw upsertError;

  return { synced: true };
}
