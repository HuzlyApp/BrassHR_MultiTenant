import type { SupabaseClient } from "@supabase/supabase-js";
import { formatShiftRange } from "@/lib/scheduling/employee-schedule";

export type WorkerScheduleEventKind = "work" | "pto" | "holiday";

export type WorkerScheduleEvent = {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  title: string;
  label: string;
  facility: string | null;
  kind: WorkerScheduleEventKind;
  /** Stable 0–3 index for work-shift color variants in the Figma legend. */
  colorIndex: number;
};

export type WorkerMonthSchedulePayload = {
  events: WorkerScheduleEvent[];
  nextShift: {
    workDate: string;
    timeRange: string;
    title: string;
    label: string;
  } | null;
  meta: {
    start: string;
    end: string;
    employmentWorkerId: string | null;
  };
};

type ShiftRow = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  work_date: string;
  start_time: string;
  end_time: string;
  title: string;
  notes: string | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;
  return trimmed;
}

function classifyEvent(title: string, notes: string | null): {
  kind: WorkerScheduleEventKind;
  label: string;
} {
  const haystack = `${title} ${notes ?? ""}`.toLowerCase();
  if (/\b(pto|paid time off|time off|vacation|sick)\b/.test(haystack)) {
    return { kind: "pto", label: title.trim() || "PTO" };
  }
  if (/\b(holiday|thanksgiving|christmas|new year|memorial day|labor day|independence day)\b/.test(haystack)) {
    return { kind: "holiday", label: title.trim() || "Holiday" };
  }
  if (/\btravel\b/.test(haystack)) {
    return { kind: "work", label: title.trim() || "Travel" };
  }
  return { kind: "work", label: title.trim() || "Working Hours" };
}

function colorIndexFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 4;
}

function compareEvents(a: WorkerScheduleEvent, b: WorkerScheduleEvent): number {
  if (a.workDate !== b.workDate) return a.workDate.localeCompare(b.workDate);
  return a.startTime.localeCompare(b.startTime);
}

export async function loadWorkerMonthSchedule(
  supabase: SupabaseClient,
  tenantId: string,
  applicantWorkerId: string,
  startDate: string,
  endDate: string
): Promise<WorkerMonthSchedulePayload> {
  const { data: employmentWorker, error: employmentError } = await supabase
    .from("workers")
    .select("id, tenant_id")
    .eq("candidate_id", applicantWorkerId)
    .maybeSingle();

  if (employmentError) throw employmentError;

  const employmentRow = employmentWorker as { id?: unknown; tenant_id?: unknown } | null;
  const employmentWorkerId =
    employmentRow &&
    typeof employmentRow.id === "string" &&
    (employmentRow.tenant_id == null || employmentRow.tenant_id === tenantId)
      ? employmentRow.id
      : null;

  if (!employmentWorkerId) {
    return {
      events: [],
      nextShift: null,
      meta: { start: startDate, end: endDate, employmentWorkerId: null },
    };
  }

  const { data: shiftData, error: shiftError } = await supabase
    .from("employee_schedule_shifts")
    .select("id, worker_id, facility_id, work_date, start_time, end_time, title, notes")
    .eq("tenant_id", tenantId)
    .eq("worker_id", employmentWorkerId)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
    .order("work_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (shiftError) throw shiftError;

  const shifts = (shiftData ?? []) as ShiftRow[];
  const facilityIds = [...new Set(shifts.map((row) => row.facility_id).filter(Boolean))] as string[];

  const { data: facilityData, error: facilityError } = facilityIds.length
    ? await supabase.from("facility").select("id, name").eq("tenant_id", tenantId).in("id", facilityIds)
    : { data: [] as NamedRow[], error: null };

  if (facilityError) throw facilityError;

  const facilityById = new Map<string, string>();
  for (const facility of (facilityData ?? []) as NamedRow[]) {
    facilityById.set(facility.id, facility.name?.trim() || "Facility");
  }

  const events: WorkerScheduleEvent[] = shifts.map((row) => {
    const startTime = normalizeTime(row.start_time);
    const endTime = normalizeTime(row.end_time);
    const title = row.title?.trim() || "Work Shift";
    const { kind, label } = classifyEvent(title, row.notes);
    const facility = row.facility_id ? facilityById.get(row.facility_id) ?? null : null;
    return {
      id: row.id,
      workDate: row.work_date,
      startTime,
      endTime,
      timeRange: formatShiftRange(startTime, endTime),
      title,
      label,
      facility,
      kind,
      colorIndex: colorIndexFor(`${facility ?? ""}:${title}`),
    };
  });

  events.sort(compareEvents);

  const today = new Date();
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(today);
  const y = todayParts.find((p) => p.type === "year")?.value ?? "0000";
  const m = todayParts.find((p) => p.type === "month")?.value ?? "01";
  const d = todayParts.find((p) => p.type === "day")?.value ?? "01";
  const hh = todayParts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = todayParts.find((p) => p.type === "minute")?.value ?? "00";
  const todayDate = `${y}-${m}-${d}`;
  const nowTime = `${hh}:${mm}:00`;

  const upcoming =
    events.find((event) => {
      if (event.workDate > todayDate) return true;
      if (event.workDate < todayDate) return false;
      return event.endTime >= nowTime;
    }) ?? null;

  return {
    events,
    nextShift: upcoming
      ? {
          workDate: upcoming.workDate,
          timeRange: upcoming.timeRange,
          title: upcoming.title,
          label: upcoming.label,
        }
      : null,
    meta: {
      start: startDate,
      end: endDate,
      employmentWorkerId,
    },
  };
}
