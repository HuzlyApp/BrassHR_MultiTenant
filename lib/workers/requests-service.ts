import type { SupabaseClient } from "@supabase/supabase-js";
import { WorkerRequestError, type RequestCreateInput, type RequestListInput } from "./requests-contract";

export const REQUEST_COLUMNS = "id,worker_id,request_type,status,start_date,end_date,reason,notes,off_type,facility_id,department_id,related_shift_id,created_by,reviewed_by,reviewed_at,review_notes,created_at,updated_at";

export async function listWorkerRequests(supabase: SupabaseClient, tenantId: string, ownWorkerIds: string[] | null, input: RequestListInput) {
  let query = supabase.from("worker_requests").select(`${REQUEST_COLUMNS}, worker:worker_id(first_name,last_name)`, { count: "exact" })
    .eq("tenant_id", tenantId).eq("worker.tenant_id", tenantId);
  if (ownWorkerIds) query = query.in("worker_id", ownWorkerIds);
  if (input.type) query = query.eq("request_type", input.type);
  if (input.status) query = query.eq("status", input.status);
  if (input.facility_id) query = query.eq("facility_id", input.facility_id);
  if (input.department_id) query = query.eq("department_id", input.department_id);
  if (input.date_from) query = query.gte("end_date", input.date_from);
  if (input.date_to) query = query.lte("start_date", input.date_to);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id")
    .range((input.page-1)*input.limit,input.page*input.limit-1);
  if (error) throw error;
  return { requests: data ?? [], total: count ?? 0, page: input.page, limit: input.limit };
}

export async function createWorkerRequest(supabase: SupabaseClient, tenantId: string, actorId: string, ownWorkerIds: string[] | null, input: RequestCreateInput) {
  const workerId = input.worker_id ?? ownWorkerIds?.[0];
  if (!workerId) throw new WorkerRequestError("Select a worker", "VALIDATION_ERROR", 422);
  if (ownWorkerIds && !ownWorkerIds.includes(workerId)) throw new WorkerRequestError("Requests can only be created for yourself", "FORBIDDEN", 403);
  const { data: worker, error: workerError } = await supabase.from("worker").select("id,department_id")
    .eq("tenant_id", tenantId).eq("id", workerId).maybeSingle();
  if (workerError) throw workerError;
  if (!worker) throw new WorkerRequestError("Worker not found in tenant", "NOT_FOUND", 404);
  if (ownWorkerIds && input.department_id !== undefined && input.department_id !== worker.department_id) {
    throw new WorkerRequestError("Use your current department", "VALIDATION_ERROR", 422);
  }
  if (ownWorkerIds && input.related_shift_id) {
    const { data: assignment, error } = await supabase.from("worker_shift_assignments").select("id")
      .eq("tenant_id", tenantId).eq("shift_id", input.related_shift_id)
      .in("worker_id", [workerId, actorId]).not("status", "in", "(cancelled,rejected)").limit(1).maybeSingle();
    if (error) throw error;
    if (!assignment) throw new WorkerRequestError("Shift is not assigned to you", "FORBIDDEN", 403);
  }
  const { data, error } = await supabase.from("worker_requests").insert({
    tenant_id: tenantId, worker_id: workerId, created_by: actorId,
    request_type: input.request_type, start_date: input.start_date, end_date: input.end_date,
    reason: input.reason, notes: input.notes ?? null,
    off_type: input.request_type === "time_off" ? input.off_type ?? "Personal Leave" : null,
    facility_id: input.facility_id ?? null, department_id: input.department_id === undefined ? worker.department_id : input.department_id,
    related_shift_id: input.related_shift_id ?? null,
  }).select(REQUEST_COLUMNS).single();
  if (error) throw error;
  return data;
}

export async function reviewWorkerRequest(supabase: SupabaseClient, tenantId: string, actorId: string, id: string, decision: "approved" | "rejected", notes?: string) {
  const { data, error } = await supabase.rpc("review_worker_request", {
    p_tenant_id: tenantId, p_request_id: id, p_actor_id: actorId, p_decision: decision, p_notes: notes ?? null,
  });
  if (error) throw error;
  return data;
}
