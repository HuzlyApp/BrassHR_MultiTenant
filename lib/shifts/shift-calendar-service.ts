import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ShiftCalendarEvent,
  ShiftCalendarFilterOptions,
  ShiftCalendarResponse,
  ShiftCalendarStatus,
} from "./types";

type ShiftRow = {
  id: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  facility_id: string | null;
  job_category_id: string | null;
};

type AssignmentRow = {
  shift_id: string;
  worker_id: string;
  status: string | null;
};

type WorkerRow = {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
};

type FacilityRow = {
  id: string;
  name: string | null;
};

type JobCategoryRow = {
  id: string;
  name: string | null;
};

function deriveHours(title: string): { startHour: number; endHour: number } {
  const t = title.toLowerCase();
  if (t.includes("night")) return { startHour: 19, endHour: 23 };
  if (t.includes("morning")) return { startHour: 7, endHour: 15 };
  if (t.includes("evening")) return { startHour: 15, endHour: 23 };
  if (t.includes("mid")) return { startHour: 11, endHour: 19 };
  return { startHour: 9, endHour: 17 };
}

function workerDisplayName(worker: WorkerRow | undefined): string {
  if (!worker) return "Unknown worker";
  const name = `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim();
  return name || "Unnamed worker";
}

function resolveAssignmentStatus(
  assignmentStatus: string | null | undefined,
  cancelled: boolean
): ShiftCalendarStatus {
  if (cancelled) return "cancelled";
  const normalized = (assignmentStatus ?? "").toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "confirmed") return "confirmed";
  return "active";
}

async function resolveWorkersByAssignmentIds(
  supabase: SupabaseClient,
  tenantId: string,
  workerIds: string[]
): Promise<Map<string, WorkerRow>> {
  if (workerIds.length === 0) return new Map();

  const uniqueIds = [...new Set(workerIds)];
  const [{ data: byUserId, error: byUserIdError }, { data: byWorkerId, error: byWorkerIdError }] =
    await Promise.all([
      supabase
        .from("worker")
        .select("id, user_id, first_name, last_name, job_role")
        .eq("tenant_id", tenantId)
        .in("user_id", uniqueIds),
      supabase
        .from("worker")
        .select("id, user_id, first_name, last_name, job_role")
        .eq("tenant_id", tenantId)
        .in("id", uniqueIds),
    ]);

  if (byUserIdError) throw byUserIdError;
  if (byWorkerIdError) throw byWorkerIdError;

  const workerByKey = new Map<string, WorkerRow>();
  for (const worker of [...((byUserId ?? []) as WorkerRow[]), ...((byWorkerId ?? []) as WorkerRow[])]) {
    workerByKey.set(worker.id, worker);
    if (worker.user_id) workerByKey.set(String(worker.user_id), worker);
  }
  return workerByKey;
}

function buildFilterOptions(events: ShiftCalendarEvent[]): ShiftCalendarFilterOptions {
  const workers = new Map<string, string>();
  const facilities = new Map<string, string>();
  const jobRoles = new Set<string>();
  const statuses = new Set<ShiftCalendarStatus>();

  for (const event of events) {
    if (event.workerId && event.workerName !== "Open shift") {
      workers.set(event.workerId, event.workerName);
    }
    if (event.facilityId) {
      facilities.set(event.facilityId, event.facility);
    }
    if (event.jobRole) jobRoles.add(event.jobRole);
    statuses.add(event.status);
  }

  return {
    workers: [...workers.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    jobRoles: [...jobRoles].sort(),
    facilities: [...facilities.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    statuses: [...statuses],
  };
}

export async function loadShiftCalendarForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<ShiftCalendarResponse> {
  const { data: shiftData, error: shiftError } = await supabase
    .from("shifts")
    .select("id, title, start_date, end_date, facility_id, job_category_id")
    .eq("tenant_id", tenantId)
    .not("start_date", "is", null)
    .lte("start_date", endDate)
    .or(`end_date.gte.${startDate},end_date.is.null`)
    .order("start_date", { ascending: true });

  if (shiftError) throw shiftError;

  const shifts = (shiftData ?? []) as ShiftRow[];
  if (shifts.length === 0) {
    return {
      events: [],
      filterOptions: { workers: [], jobRoles: [], facilities: [], statuses: [] },
      meta: { tenantId, start: startDate, end: endDate, total: 0 },
    };
  }

  const shiftIds = shifts.map((row) => row.id);
  const facilityIds = [...new Set(shifts.map((s) => s.facility_id).filter(Boolean))] as string[];
  const jobCategoryIds = [...new Set(shifts.map((s) => s.job_category_id).filter(Boolean))] as string[];

  const [
    { data: assignmentData, error: assignmentError },
    { data: facilityData, error: facilityError },
    { data: jobCategoryData, error: jobCategoryError },
    { data: cancellationData, error: cancellationError },
  ] = await Promise.all([
    supabase
      .from("worker_shift_assignments")
      .select("shift_id, worker_id, status")
      .eq("tenant_id", tenantId)
      .in("shift_id", shiftIds),
    facilityIds.length
      ? supabase.from("facility").select("id, name").eq("tenant_id", tenantId).in("id", facilityIds)
      : Promise.resolve({ data: [] as FacilityRow[], error: null }),
    jobCategoryIds.length
      ? supabase.from("job_categories").select("id, name").in("id", jobCategoryIds)
      : Promise.resolve({ data: [] as JobCategoryRow[], error: null }),
    supabase.from("shift_cancellations").select("shift_id").eq("tenant_id", tenantId).in("shift_id", shiftIds),
  ]);

  if (assignmentError) throw assignmentError;
  if (facilityError) throw facilityError;
  if (jobCategoryError) throw jobCategoryError;
  if (cancellationError) throw cancellationError;

  const assignments = (assignmentData ?? []) as AssignmentRow[];
  const workerIds = [...new Set(assignments.map((a) => a.worker_id).filter(Boolean))];
  const workerByKey = await resolveWorkersByAssignmentIds(supabase, tenantId, workerIds);

  const facilityById = new Map<string, FacilityRow>();
  for (const facility of (facilityData ?? []) as FacilityRow[]) {
    facilityById.set(facility.id, facility);
  }

  const jobCategoryById = new Map<string, JobCategoryRow>();
  for (const category of (jobCategoryData ?? []) as JobCategoryRow[]) {
    jobCategoryById.set(category.id, category);
  }

  const cancelledShiftIds = new Set(
    ((cancellationData ?? []) as { shift_id: string }[]).map((row) => row.shift_id)
  );

  const assignmentsByShift = new Map<string, AssignmentRow[]>();
  for (const assignment of assignments) {
    const existing = assignmentsByShift.get(assignment.shift_id) ?? [];
    existing.push(assignment);
    assignmentsByShift.set(assignment.shift_id, existing);
  }

  const events: ShiftCalendarEvent[] = [];

  for (const shift of shifts) {
    if (!shift.start_date) continue;

    const shiftEndDate = shift.end_date ?? shift.start_date;
    const categoryName = shift.job_category_id
      ? (jobCategoryById.get(shift.job_category_id)?.name ?? "Unassigned role")
      : "Unassigned role";
    const facilityId = shift.facility_id ? String(shift.facility_id) : null;
    const facilityName = facilityId
      ? (facilityById.get(facilityId)?.name ?? "Unknown facility")
      : "Unknown facility";
    const title = shift.title?.trim() || categoryName || "Shift";
    const { startHour, endHour } = deriveHours(title);
    const cancelled = cancelledShiftIds.has(shift.id);
    const relatedAssignments = assignmentsByShift.get(shift.id) ?? [];

    if (relatedAssignments.length === 0) {
      events.push({
        id: `${shift.id}-open`,
        shiftId: shift.id,
        title,
        startDate: shift.start_date,
        endDate: shiftEndDate,
        startHour,
        endHour,
        workerName: "Open shift",
        workerId: null,
        jobRole: categoryName,
        facility: facilityName,
        facilityId,
        status: cancelled ? "cancelled" : "active",
      });
      continue;
    }

    for (const assignment of relatedAssignments) {
      const worker = workerByKey.get(assignment.worker_id);
      events.push({
        id: `${shift.id}-${assignment.worker_id}`,
        shiftId: shift.id,
        title,
        startDate: shift.start_date,
        endDate: shiftEndDate,
        startHour,
        endHour,
        workerName: workerDisplayName(worker),
        workerId: assignment.worker_id,
        jobRole: worker?.job_role?.trim() || categoryName,
        facility: facilityName,
        facilityId,
        status: resolveAssignmentStatus(assignment.status, cancelled),
      });
    }
  }

  return {
    events,
    filterOptions: buildFilterOptions(events),
    meta: { tenantId, start: startDate, end: endDate, total: events.length },
  };
}
