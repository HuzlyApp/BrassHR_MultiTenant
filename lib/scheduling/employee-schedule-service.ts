import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseEmployeeScheduleShiftInput,
  type CreateEmployeeScheduleShiftInput,
  type EmployeeScheduleEmployee,
  type EmployeeScheduleShift,
  type EmployeeScheduleWeekResponse,
} from "./employee-schedule";

type WorkerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
};

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
    .select("id, first_name, last_name, job_role")
    .eq("tenant_id", tenantId)
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (workerError) throw workerError;

  let shiftQuery = supabase
    .from("employee_schedule_shifts")
    .select(
      "id, worker_id, facility_id, department_id, work_date, start_time, end_time, title, rate_per_hour, notes"
    )
    .eq("tenant_id", tenantId)
    .gte("work_date", startDate)
    .lte("work_date", endDate)
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

  const [{ data: facilityData, error: facilityError }, { data: departmentData, error: departmentError }] =
    await Promise.all([
      facilityIds.length
        ? supabase.from("facility").select("id, name").eq("tenant_id", tenantId).in("id", facilityIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
      departmentIds.length
        ? supabase.from("departments").select("id, name").eq("tenant_id", tenantId).in("id", departmentIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
    ]);

  if (facilityError) throw facilityError;
  if (departmentError) throw departmentError;

  const facilityById = new Map<string, string>();
  for (const facility of (facilityData ?? []) as NamedRow[]) {
    facilityById.set(facility.id, facility.name?.trim() || "Facility");
  }

  const departmentById = new Map<string, string>();
  for (const department of (departmentData ?? []) as NamedRow[]) {
    if (department.name?.trim()) departmentById.set(department.id, department.name.trim());
  }

  const employees: EmployeeScheduleEmployee[] = ((workerData ?? []) as WorkerRow[])
    .map((row) => ({
      id: row.id,
      name: employeeName(row),
      jobRole: row.job_role?.trim() || "Employee",
    }))
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
