import type { SupabaseClient } from "@supabase/supabase-js";
import { OFF_TYPES, type WhoIsOffQuery } from "./v1-contract";

export function offTypeFromShiftTitle(title: string): (typeof OFF_TYPES)[number] | null {
  const name = title.trim().toLowerCase().replace(/\s*\(pto\)$/, "").trim();
  if (name === "pto") return "Personal Leave";
  return OFF_TYPES.find((type) => type.toLowerCase() === name) ?? null;
}

export async function loadScheduledTimeOff(supabase: SupabaseClient, tenantId: string, start: string, end: string, facilityId?: string, offType?: string) {
  let query = supabase.from("employee_schedule_shifts")
    .select("id,worker_id,facility_id,work_date,title,worker:workers!worker_id(first_name,last_name,job_role,candidate_id),facility(name)")
    .eq("tenant_id", tenantId).eq("worker.tenant_id", tenantId).eq("facility.tenant_id", tenantId)
    .gte("work_date", start).lte("work_date", end).limit(1000);
  if (facilityId) query = query.eq("facility_id", facilityId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const type = offTypeFromShiftTitle(String(row.title ?? ""));
    if (!row.worker_id || !type || (offType && type !== offType)) return [];
    const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
    return [{ id: `schedule-${row.id}`, worker_id: worker?.candidate_id || row.worker_id,
      facility_id: row.facility_id, off_type: type, start_date: row.work_date, end_date: row.work_date,
      days: 1, worker: worker ?? null, facility: row.facility }];
  });
}

export function tenantTimeOffQuery(supabase: SupabaseClient, tenantId: string) {
  return supabase.from("worker_time_off").select(
    "id,worker_id,facility_id,off_type,start_date,end_date,days,source_request_id,worker!inner(id,first_name,last_name,job_role,department_id),facility(name)",
    { count: "exact" },
  ).eq("tenant_id", tenantId).eq("worker.tenant_id", tenantId).eq("facility.tenant_id", tenantId);
}

/** Existing leave blocks are already effective; pending requests are not stored here. */
export async function loadTenantTimeOff(supabase: SupabaseClient, tenantId: string, query: WhoIsOffQuery) {
  let db = tenantTimeOffQuery(supabase, tenantId)
    .lte("start_date", query.date_to).gte("end_date", query.date_from);
  if (query.facility_id) db = db.eq("facility_id", query.facility_id);
  if (query.department_id) db = db.eq("worker.department_id", query.department_id);
  if (query.off_type && query.off_type !== "Holiday") db = db.eq("off_type", query.off_type);
  if (query.off_type === "Holiday") return { records: [], total: 0, page: query.page, limit: query.limit };
  const { data, error, count } = await db.order("start_date").order("id")
    .range((query.page - 1) * query.limit, query.page * query.limit - 1);
  if (error) throw error;
  return { records: data ?? [], total: count ?? 0, page: query.page, limit: query.limit };
}
