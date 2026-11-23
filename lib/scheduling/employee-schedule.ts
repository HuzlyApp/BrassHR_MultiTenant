export type EmployeeScheduleEmployee = {
  id: string;
  name: string;
  jobRole: string;
  /** Linked job requisition when known (for job details navigation). */
  jobId: string | null;
};

export type EmployeeScheduleShift = {
  id: string;
  workerId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  title: string;
  facilityId: string | null;
  facility: string;
  departmentId: string | null;
  department: string | null;
  ratePerHour: number | null;
  notes: string | null;
};

export type EmployeeScheduleWeekResponse = {
  employees: EmployeeScheduleEmployee[];
  shifts: EmployeeScheduleShift[];
  meta: {
    tenantId: string;
    start: string;
    end: string;
    total: number;
  };
};

export type CreateEmployeeScheduleShiftInput = {
  workerId?: string | null;
  facilityId?: string | null;
  departmentId?: string | null;
  workDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  title?: string | null;
  ratePerHour?: number | string | null;
  notes?: string | null;
};

export type ParsedEmployeeScheduleShift = {
  workerId: string;
  facilityId: string | null;
  departmentId: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  title: string;
  ratePerHour: number | null;
  notes: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function formatClockLabel(value: string): string {
  const match = TIME_RE.exec(value.trim());
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function formatShiftRange(startTime: string, endTime: string): string {
  const overnight = endTime.slice(0, 5) < startTime.slice(0, 5);
  return `${formatClockLabel(startTime)} - ${formatClockLabel(endTime)}${overnight ? " (next day)" : ""}`;
}

export type ShiftTimeWindow = {
  workDate: string;
  startTime: string;
  endTime: string;
};

export class EmployeeScheduleConflictError extends Error {
  readonly status = 409;
  readonly code = "SHIFT_OVERLAP";

  constructor(message: string) {
    super(message);
    this.name = "EmployeeScheduleConflictError";
  }
}

function normalizeClock(value: string): { hour: number; minute: number } | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Absolute minutes from UTC epoch so overnight ranges compare correctly. */
export function shiftIntervalMinutes(window: ShiftTimeWindow): { start: number; end: number } | null {
  if (!DATE_RE.test(window.workDate.trim())) return null;
  const startClock = normalizeClock(window.startTime);
  const endClock = normalizeClock(window.endTime);
  if (!startClock || !endClock) return null;

  const [year, month, day] = window.workDate.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day, startClock.hour, startClock.minute) / 60_000;
  let end = Date.UTC(year, month - 1, day, endClock.hour, endClock.minute) / 60_000;
  // Overnight shifts store end_time earlier than start_time on the same work_date.
  if (end <= start) end += 24 * 60;
  return { start, end };
}

export function shiftsOverlap(a: ShiftTimeWindow, b: ShiftTimeWindow): boolean {
  const left = shiftIntervalMinutes(a);
  const right = shiftIntervalMinutes(b);
  if (!left || !right) return false;
  return left.start < right.end && right.start < left.end;
}

export function addDaysToIsoDate(isoDate: string, deltaDays: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatEmployeeShiftOverlapMessage(conflict: {
  title: string;
  workDate: string;
  startTime: string;
  endTime: string;
}): string {
  const title = conflict.title.trim() || "another shift";
  return (
    `This worker is already booked for "${title}" ` +
    `(${formatShiftRange(conflict.startTime, conflict.endTime)}) on ${conflict.workDate}. ` +
    `Choose a different time or worker.`
  );
}

export function parseEmployeeScheduleShiftInput(
  input: CreateEmployeeScheduleShiftInput
): { ok: true; value: ParsedEmployeeScheduleShift } | { ok: false; error: string } {
  const title = input.title?.trim() ?? "";
  if (!title) return { ok: false, error: "Shift title is required." };
  if (title.length > 120) return { ok: false, error: "Shift title must be 120 characters or fewer." };

  const workerId = input.workerId?.trim() ?? "";
  if (!workerId) return { ok: false, error: "Select an employee for this shift." };

  const workDate = input.workDate?.trim() ?? "";
  if (!DATE_RE.test(workDate)) return { ok: false, error: "A valid shift date is required." };

  const startMatch = TIME_RE.exec(input.startTime?.trim() ?? "");
  const endMatch = TIME_RE.exec(input.endTime?.trim() ?? "");
  if (!startMatch || !endMatch) return { ok: false, error: "Start and end times are required." };

  const startTime = `${startMatch[1]}:${startMatch[2]}:00`;
  const endTime = `${endMatch[1]}:${endMatch[2]}:00`;
  if (startTime === endTime) return { ok: false, error: "Start and end times must be different." };

  let ratePerHour: number | null = null;
  if (input.ratePerHour !== null && input.ratePerHour !== undefined && input.ratePerHour !== "") {
    const rate = typeof input.ratePerHour === "number" ? input.ratePerHour : Number(input.ratePerHour);
    if (!Number.isFinite(rate) || rate < 0) {
      return { ok: false, error: "Rate per hour must be a positive amount." };
    }
    ratePerHour = Math.round(rate * 100) / 100;
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 2000) {
    return { ok: false, error: "Notes must be 2000 characters or fewer." };
  }

  return {
    ok: true,
    value: {
      workerId,
      facilityId: input.facilityId?.trim() || null,
      departmentId: input.departmentId?.trim() || null,
      workDate,
      startTime,
      endTime,
      title,
      ratePerHour,
      notes,
    },
  };
}
