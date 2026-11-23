import type { SupabaseClient } from "@supabase/supabase-js";
import { getApplicationAppliedJobsByWorker } from "@/lib/workers/worker-application-job-titles";
import {
  addDaysToIsoDate,
  EmployeeScheduleConflictError,
  formatEmployeeShiftOverlapMessage,
  parseEmployeeScheduleShiftInput,
  shiftsOverlap,
  type CreateEmployeeScheduleShiftInput,
  type EmployeeScheduleEmployee,
  type EmployeeScheduleShift,
  type EmployeeScheduleWeekResponse,
  type ParsedEmployeeScheduleShift,
} from "./employee-schedule";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  source_job_application_id?: string | null;
  application_snapshot?: Record<string, unknown> | null;
};

function jobIdFromSnapshot(snapshot: Record<string, unknown> | null | undefined): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const candidates = [
    snapshot.jobRequisitionId,
    snapshot.job_requisition_id,
    snapshot.job_id,
    snapshot.jobId,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

type ShiftRow = {
  id: string;
  worker_id: string;
  facility_id: string | null;
  department_id: string | null;
  work_date: string;
  start_time: string;
  end_time: string;
  title: string;
  rate_per_hour: number | string | null;
  notes: string | null;
};

type NamedRow = {
  id: string;
  name: string | null;
};

/** Shared employee block query for the legacy week grid and v1 range API. */
export function tenantEmployeeShiftQuery(supabase: SupabaseClient, tenantId: string, startDate: string, endDate: string) {
  return supabase.from("employee_schedule_shifts")
    .select("id,worker_id,facility_id,department_id,work_date,start_time,end_time,title,rate_per_hour,notes", { count: "exact" })
    .eq("tenant_id", tenantId).gte("work_date", startDate).lte("work_date", endDate);
}

function employeeName(row: WorkerRow): string {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return name || "Employee";
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const rate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(rate) ? rate : null;
}

function mapShift(
  row: ShiftRow,
  facilityName: string,
  departmentName: string | null
): EmployeeScheduleShift {
  return {
    id: row.id,
    workerId: row.worker_id,
    workDate: row.work_date,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    facilityId: row.facility_id,
    facility: facilityName,
    departmentId: row.department_id,
    department: departmentName,
    ratePerHour: toNumber(row.rate_per_hour),
    notes: row.notes,
  };
}

export async function loadEmployeeScheduleWeek(
  supabase: SupabaseClient,
  tenantId: string,
  startDate: string,
  endDate: string,
  facilityId?: string | null
): Promise<EmployeeScheduleWeekResponse> {
  const { data: workerData, error: workerError } = await supabase
    .from("workers")
    .select("id, first_name, last_name, job_role, source_job_application_id, application_snapshot")
    .eq("tenant_id", tenantId)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (workerError) throw workerError;

  const workerRows = (workerData ?? []) as WorkerRow[];
  const workerIds = workerRows.map((row) => row.id).filter(Boolean);

  let shiftQuery = tenantEmployeeShiftQuery(supabase, tenantId, startDate, endDate)
    .order("work_date", { ascending: true })
    .order("start_time", { ascending: true });

  const scopedFacilityId = facilityId?.trim() || "";
  if (scopedFacilityId) {
    shiftQuery = shiftQuery.eq("facility_id", scopedFacilityId);
  }

  const { data: shiftData, error: shiftError } = await shiftQuery;
  if (shiftError) throw shiftError;

  const shifts = (shiftData ?? []) as ShiftRow[];
  const facilityIds = [...new Set(shifts.map((row) => row.facility_id).filter(Boolean))] as string[];
  const departmentIds = [...new Set(shifts.map((row) => row.department_id).filter(Boolean))] as string[];
  const sourceApplicationIds = [
    ...new Set(
      workerRows
        .map((row) => row.source_job_application_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [
    { data: facilityData, error: facilityError },
    { data: departmentData, error: departmentError },
    appliedJobsByWorker,
    { data: sourceAppData, error: sourceAppError },
  ] = await Promise.all([
    facilityIds.length
      ? supabase.from("facility").select("id, name").eq("tenant_id", tenantId).in("id", facilityIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
    departmentIds.length
      ? supabase.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", departmentIds)
      : Promise.resolve({ data: [] as NamedRow[], error: null }),
    getApplicationAppliedJobsByWorker(supabase, { tenantId, workerIds }),
    sourceApplicationIds.length
      ? supabase
          .from("job_applications")
          .select("id, job_requisition_id")
          .eq("tenant_id", tenantId)
          .in("id", sourceApplicationIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; job_requisition_id: string | null }>,
          error: null,
        }),
  ]);

  if (facilityError) throw facilityError;
  if (departmentError) throw departmentError;
  if (sourceAppError) throw sourceAppError;

  const facilityById = new Map<string, string>();
  for (const facility of (facilityData ?? []) as NamedRow[]) {
    facilityById.set(facility.id, facility.name?.trim() || "Facility");
  }

  const departmentById = new Map<string, string>();
  for (const department of (departmentData ?? []) as NamedRow[]) {
    if (department.name?.trim()) departmentById.set(department.id, department.name.trim());
  }

  const jobIdBySourceApplication = new Map<string, string>();
  for (const row of (sourceAppData ?? []) as Array<{ id: string; job_requisition_id: string | null }>) {
    const jobId = row.job_requisition_id?.trim();
    if (row.id && jobId) jobIdBySourceApplication.set(row.id, jobId);
  }

  const employees: EmployeeScheduleEmployee[] = workerRows
    .map((row) => {
      const jobRole = row.job_role?.trim() || "Employee";
      const appliedJobs = appliedJobsByWorker.get(row.id) ?? [];
      const matchedApplied =
        appliedJobs.find(
          (job) => job.title.trim().toLowerCase() === jobRole.toLowerCase()
        ) ?? appliedJobs[0];
      const sourceAppId = row.source_job_application_id?.trim() || "";
      const jobId =
        jobIdFromSnapshot(row.application_snapshot) ||
        (sourceAppId ? jobIdBySourceApplication.get(sourceAppId) ?? null : null) ||
        matchedApplied?.jobId ||
        null;

      return {
        id: row.id,
        name: employeeName(row),
        jobRole,
        jobId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const mappedShifts = shifts.map((row) =>
    mapShift(
      row,
      row.facility_id ? (facilityById.get(row.facility_id) ?? "Facility") : "No facility",
      row.department_id ? (departmentById.get(row.department_id) ?? null) : null
    )
  );

  return {
    employees,
    shifts: mappedShifts,
    meta: {
      tenantId,
      start: startDate,
      end: endDate,
      total: mappedShifts.length,
    },
  };
}

async function assertNoWorkerShiftOverlap(
  supabase: SupabaseClient,
  tenantId: string,
  value: ParsedEmployeeScheduleShift,
  excludeShiftId?: string | null
) {
  const fromDate = addDaysToIsoDate(value.workDate, -1);
  const toDate = addDaysToIsoDate(value.workDate, 1);
  const { data, error } = await supabase
    .from("employee_schedule_shifts")
    .select("id, title, work_date, start_time, end_time")
    .eq("tenant_id", tenantId)
    .eq("worker_id", value.workerId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate);

  if (error) throw error;

  const excludeId = excludeShiftId?.trim() || "";
  const conflict = ((data ?? []) as Array<{
    id: string;
    title: string;
    work_date: string;
    start_time: string;
    end_time: string;
  }>).find((row) => {
    if (excludeId && row.id === excludeId) return false;
    return shiftsOverlap(
      {
        workDate: value.workDate,
        startTime: value.startTime,
        endTime: value.endTime,
      },
      {
        workDate: row.work_date,
        startTime: row.start_time,
        endTime: row.end_time,
      }
    );
  });

  if (conflict) {
    throw new EmployeeScheduleConflictError(
      formatEmployeeShiftOverlapMessage({
        title: conflict.title,
        workDate: conflict.work_date,
        startTime: conflict.start_time,
        endTime: conflict.end_time,
      })
    );
  }
}

export async function createEmployeeScheduleShift(
  supabase: SupabaseClient,
  tenantId: string,
  input: CreateEmployeeScheduleShiftInput
) {
  const parsed = parseEmployeeScheduleShiftInput(input);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const value = parsed.value;
  await assertNoWorkerShiftOverlap(supabase, tenantId, value);

  const { data, error } = await supabase
    .from("employee_schedule_shifts")
    .insert({
      tenant_id: tenantId,
      worker_id: value.workerId,
      facility_id: value.facilityId,
      department_id: value.departmentId,
      work_date: value.workDate,
      start_time: value.startTime,
      end_time: value.endTime,
      title: value.title,
      rate_per_hour: value.ratePerHour,
      notes: value.notes,
    })
    .select(
      "id, worker_id, facility_id, department_id, work_date, start_time, end_time, title, rate_per_hour, notes"
    )
    .single();

  if (error) throw error;

  return mapShift(data as ShiftRow, "Facility", null);
}

export async function updateEmployeeScheduleShift(
  supabase: SupabaseClient,
  tenantId: string,
  shiftId: string,
  input: CreateEmployeeScheduleShiftInput
) {
  const id = shiftId.trim();
  if (!id) {
    throw new Error("Shift id is required.");
  }

  const parsed = parseEmployeeScheduleShiftInput(input);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const value = parsed.value;
  await assertNoWorkerShiftOverlap(supabase, tenantId, value, id);

  const { data, error } = await supabase
    .from("employee_schedule_shifts")
    .update({
      worker_id: value.workerId,
      facility_id: value.facilityId,
      department_id: value.departmentId,
      work_date: value.workDate,
      start_time: value.startTime,
      end_time: value.endTime,
      title: value.title,
      rate_per_hour: value.ratePerHour,
      notes: value.notes,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select(
      "id, worker_id, facility_id, department_id, work_date, start_time, end_time, title, rate_per_hour, notes"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Shift not found.");
  }

  let facilityName = "No facility";
  if (data.facility_id) {
    const { data: facility } = await supabase
      .from("facilities")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", data.facility_id)
      .maybeSingle();
    facilityName = facility?.name?.trim() || "Facility";
  }

  let departmentName: string | null = null;
  if (data.department_id) {
    const { data: department } = await supabase
      .from("departments")
      .select("name")
      .eq("tenant_id", tenantId)
      .eq("id", data.department_id)
      .maybeSingle();
    departmentName = department?.name?.trim() || null;
  }

  return mapShift(data as ShiftRow, facilityName, departmentName);
}
