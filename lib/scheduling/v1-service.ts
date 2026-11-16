import type { SupabaseClient } from "@supabase/supabase-js";
import { createTenantShift } from "@/lib/shifts/shift-management-service";
import { loadTenantTimeOff } from "./time-off-service";
import { tenantEmployeeShiftQuery } from "./employee-schedule-service";
import { shiftSchema, SchedulingError, type ScheduleQuery, type HolidayQuery, type ShiftInput } from "./v1-contract";

type Features = Record<string, boolean>;
export const SHIFT_COLUMNS = "id,title,description,start_date,end_date,facility_id,client_id,department_id,is_internal,job_category_id,number_of_people_needed,rate_per_hour";

export function validateShiftFeatures(shift: ShiftInput, features: Features, edition: string) {
  if (shift.is_internal) {
    if (!features.internal_scheduling) throw new SchedulingError("Internal scheduling is disabled", "FEATURE_DISABLED", 403);
    if (shift.client_id) throw new SchedulingError("Internal shifts cannot specify a client", "VALIDATION_ERROR", 422);
  } else {
    if (!features.manage_clients) throw new SchedulingError("Client scheduling is disabled", "FEATURE_DISABLED", 403);
    if (!shift.client_id && edition === "staffing") throw new SchedulingError("A client is required for staffing shifts", "VALIDATION_ERROR", 422);
  }
}

function visibleShift<T extends Record<string, unknown>>(shift: T, features: Features) {
  if (features.manage_clients) return shift;
  const { client_id: _client, ...visible } = shift;
  void _client;
  return visible;
}

export async function listTenantHolidays(supabase: SupabaseClient, tenantId: string, input: HolidayQuery) {
  let query = supabase.from("tenant_holidays").select("id,name,holiday_date,is_paid", { count: "exact" }).eq("tenant_id", tenantId);
  if (input.date_from) query = query.gte("holiday_date", input.date_from);
  if (input.date_to) query = query.lte("holiday_date", input.date_to);
  const { data, error, count } = await query.order("holiday_date").order("id").range((input.page-1)*input.limit,input.page*input.limit-1);
  if (error) throw error;
  return { holidays: data ?? [], total: count ?? 0, page: input.page, limit: input.limit };
}

export async function loadTenantSchedule(supabase: SupabaseClient, tenantId: string, input: ScheduleQuery, features: Features) {
  let shifts = supabase.from("shifts").select(SHIFT_COLUMNS, { count: "exact" }).eq("tenant_id", tenantId)
    .lte("start_date", input.date_to).or(`end_date.gte.${input.date_from},end_date.is.null`);
  if (input.facility_id) shifts = shifts.eq("facility_id", input.facility_id);
  if (input.department_id) shifts = shifts.eq("department_id", input.department_id);
  if (!features.manage_clients) shifts = shifts.eq("is_internal", true);
  if (!features.internal_scheduling) shifts = shifts.eq("is_internal", false);
  let employees = tenantEmployeeShiftQuery(supabase, tenantId, input.date_from, input.date_to);
  if (input.facility_id) employees = employees.eq("facility_id", input.facility_id);
  if (input.department_id) employees = employees.eq("department_id", input.department_id);
  const [shiftResult, employeeResult, holidays, timeOff] = await Promise.all([
    shifts.order("start_date").order("id").range((input.page-1)*input.limit,input.page*input.limit-1),
    features.internal_scheduling ? employees.order("work_date").order("id").range((input.page-1)*input.limit,input.page*input.limit-1)
      : Promise.resolve({ data: [], count: 0, error: null }),
    listTenantHolidays(supabase, tenantId, input),
    loadTenantTimeOff(supabase, tenantId, input),
  ]);
  if (shiftResult.error) throw shiftResult.error;
  if (employeeResult.error) throw employeeResult.error;
  return { shifts: (shiftResult.data ?? []).map((s) => visibleShift(s, features)), total: shiftResult.count ?? 0,
    employee_shifts: (employeeResult.data ?? []).map((row) => ({ ...row, is_internal: true as const })), employee_shifts_total: employeeResult.count ?? 0,
    holidays: holidays.holidays, holidays_total: holidays.total, time_off: timeOff.records, time_off_total: timeOff.total,
    view: input.view, page: input.page, limit: input.limit };
}

export async function createScheduleShift(supabase: SupabaseClient, tenantId: string, input: ShiftInput, features: Features, edition: string) {
  validateShiftFeatures(input, features, edition);
  const { shift } = await createTenantShift(supabase, tenantId, {
    title: input.title, description: input.description, startDate: input.start_date, endDate: input.end_date,
    facilityId: input.facility_id, clientId: input.client_id, departmentId: input.department_id,
    isInternal: input.is_internal, jobCategoryId: input.job_category_id,
    numberOfPeopleNeeded: input.number_of_people_needed, ratePerHour: input.rate_per_hour,
  });
  return visibleShift(shift, features);
}

export async function patchScheduleShift(supabase: SupabaseClient, tenantId: string, id: string, patch: Record<string, unknown>, features: Features, edition: string) {
  const { data: current, error: readError } = await supabase.from("shifts").select(SHIFT_COLUMNS).eq("tenant_id", tenantId).eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (!current) throw new SchedulingError("Shift not found", "NOT_FOUND", 404);
  // The stored id is not part of the writable contract.
  const { id: _id, ...fields } = { ...current, ...patch };
  void _id;
  const checked = shiftSchema.safeParse(fields);
  if (!checked.success) throw new SchedulingError("Invalid shift values", "VALIDATION_ERROR", 422);
  validateShiftFeatures(checked.data, features, edition);
  const { data, error } = await supabase.from("shifts").update(patch).eq("tenant_id", tenantId).eq("id", id).select(SHIFT_COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new SchedulingError("Shift not found", "NOT_FOUND", 404);
  return visibleShift(data, features);
}
