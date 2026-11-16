import type { SupabaseClient } from "@supabase/supabase-js";
import type { WhoIsOffQuery } from "./v1-contract";

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
