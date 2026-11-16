import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimesheetListInput } from "./v1-contract";
import { TimeApiError } from "./v1-contract";

const ENTRY_COLUMNS =
  "id,worker_id,facility_id,department_id,work_date,regular_minutes,overtime_minutes,break_minutes,clock_in,clock_out";
const SHEET_COLUMNS =
  "id,worker_id,period_start,period_end,status,regular_minutes,overtime_minutes,break_minutes,submitted_by,submitted_at,reviewed_by,reviewed_at,review_notes";
type Entry = {
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
};
type SheetView = {
  id: string;
  worker_id: string;
  regular_minutes: number;
  overtime_minutes: number;
  entries: Entry[];
  [key: string]: unknown;
};

export async function listPeriodTimesheets(
  sb: SupabaseClient,
  tenantId: string,
  owned: string[] | null,
  input: TimesheetListInput,
) {
  if (owned && input.worker_id && !owned.includes(input.worker_id))
    throw new TimeApiError("Worker not in your scope", "FORBIDDEN", 403);
  const join =
    input.facility_id || input.department_id
      ? "employee_timesheet_entries!inner"
      : "employee_timesheet_entries";
  let q = sb
    .from("timesheets")
    .select(`${SHEET_COLUMNS},entries:${join}(${ENTRY_COLUMNS})`, {
      count: "exact",
    })
    .eq("tenant_id", tenantId)
    .eq("entries.tenant_id", tenantId)
    .lte("period_start", input.period_end)
    .gte("period_end", input.period_start)
    .gte("entries.work_date", input.period_start)
    .lte("entries.work_date", input.period_end);
  if (owned) q = q.in("worker_id", owned);
  if (input.worker_id) q = q.eq("worker_id", input.worker_id);
  if (input.status) q = q.eq("status", input.status);
  if (input.facility_id) q = q.eq("entries.facility_id", input.facility_id);
  if (input.department_id)
    q = q.eq("entries.department_id", input.department_id);
  const { data, error, count } = await q
    .order("period_start")
    .order("id")
    .range((input.page - 1) * input.limit, input.page * input.limit - 1)
    .returns<SheetView[]>();
  if (error) throw error;
  const { data: summary, error: summaryError } = await sb.rpc(
    "summarize_period_timesheets",
    {
      p_tenant: tenantId,
      p_start: input.period_start,
      p_end: input.period_end,
      p_owned: owned,
      p_worker: input.worker_id ?? null,
      p_facility: input.facility_id ?? null,
      p_department: input.department_id ?? null,
      p_status: input.status ?? null,
    },
  );
  if (summaryError) throw summaryError;
  const timesheets = (data ?? []).map((sheet) => ({
    ...sheet,
    period_regular_minutes: sheet.regular_minutes,
    period_overtime_minutes: sheet.overtime_minutes,
    regular_minutes: sheet.entries.reduce((n, e) => n + e.regular_minutes, 0),
    overtime_minutes: sheet.entries.reduce((n, e) => n + e.overtime_minutes, 0),
    break_minutes: sheet.entries.reduce((n, e) => n + e.break_minutes, 0),
  }));
  return {
    timesheets,
    summary,
    total: count ?? 0,
    page: input.page,
    limit: input.limit,
  };
}

export async function getPeriodTimesheet(
  sb: SupabaseClient,
  tenantId: string,
  owned: string[] | null,
  id: string,
) {
  let q = sb
    .from("timesheets")
    .select(
      `${SHEET_COLUMNS},entries:employee_timesheet_entries(${ENTRY_COLUMNS})`,
    )
    .eq("tenant_id", tenantId)
    .eq("entries.tenant_id", tenantId)
    .eq("id", id);
  if (owned) q = q.in("worker_id", owned);
  const { data, error } = await q.maybeSingle<SheetView>();
  if (error) throw error;
  if (!data) throw new TimeApiError("Timesheet not found", "NOT_FOUND", 404);
  return data;
}

export async function transitionPeriodTimesheet(
  sb: SupabaseClient,
  tenantId: string,
  actorId: string,
  id: string,
  action: "submit" | "approve" | "reject",
  notes?: string,
) {
  const { data, error } = await sb.rpc("transition_timesheet", {
    p_tenant: tenantId,
    p_sheet: id,
    p_actor: actorId,
    p_action: action,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function recordEmployeeClockEvent(
  sb: SupabaseClient,
  tenantId: string,
  actorId: string,
  owned: string[] | null,
  input: {
    action: string;
    worker_id?: string;
    facility_id?: string;
    shift_id?: string;
    location?: {
      latitude: number;
      longitude: number;
      timestamp: string;
      permissionStatus: string;
    };
  },
  ip: string | null,
) {
  const id = input.worker_id ?? owned?.[0];
  if (!id)
    throw new TimeApiError("Select an employee", "VALIDATION_ERROR", 422);
  if (owned && !owned.includes(id))
    throw new TimeApiError("Clock only for yourself", "FORBIDDEN", 403);
  const { data, error } = await sb.rpc("record_clock_event", {
    p_tenant: tenantId,
    p_employee: id,
    p_actor: actorId,
    p_action: input.action,
    p_facility: input.facility_id ?? null,
    p_shift: input.shift_id ?? null,
    p_lat: input.location?.latitude ?? null,
    p_lng: input.location?.longitude ?? null,
    p_location_at: input.location?.timestamp ?? null,
    p_permission: input.location?.permissionStatus ?? null,
    p_ip: ip,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: row.id,
    worker_id: id,
    attendance_date: row.attendance_date,
    status: row.status,
    clock_in_at: row.clock_in_at,
    clock_out_at: row.clock_out_at,
    break_started_at: row.break_started_at,
    break_seconds: row.break_seconds,
    total_seconds: row.total_seconds,
  };
}
