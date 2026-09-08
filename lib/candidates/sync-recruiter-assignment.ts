import type { SupabaseClient } from "@supabase/supabase-js";

type Sb = SupabaseClient;

/**
 * Keep worker-level and application-level assignee in sync.
 * - Old candidates list reads `worker.assigned_recruiter_user_id`
 * - All candidates (applications) list reads `job_applications.assigned_recruiter_user_id`
 */

export async function updateWorkerAssignee(
  supabase: Sb,
  params: {
    tenantId: string;
    workerId: string;
    assignedRecruiterUserId: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("worker")
    .update({
      assigned_recruiter_user_id: params.assignedRecruiterUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.workerId)
    .eq("tenant_id", params.tenantId);
  return { error: error?.message ?? null };
}

export async function updateAllApplicationsAssigneeForWorker(
  supabase: Sb,
  params: {
    tenantId: string;
    workerId: string;
    assignedRecruiterUserId: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("job_applications")
    .update({
      assigned_recruiter_user_id: params.assignedRecruiterUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("worker_id", params.workerId)
    .eq("tenant_id", params.tenantId);
  return { error: error?.message ?? null };
}

/** Assign/unassign from old candidates screen: worker + all of their applications. */
export async function syncAssigneeFromWorker(
  supabase: Sb,
  params: {
    tenantId: string;
    workerId: string;
    assignedRecruiterUserId: string | null;
  }
): Promise<{ error: string | null }> {
  const workerResult = await updateWorkerAssignee(supabase, params);
  if (workerResult.error) return workerResult;
  return updateAllApplicationsAssigneeForWorker(supabase, params);
}

/** Assign/unassign from applications screen: that application + linked worker. */
export async function syncAssigneeFromApplication(
  supabase: Sb,
  params: {
    tenantId: string;
    applicationId: string;
    assignedRecruiterUserId: string | null;
  }
): Promise<{
  error: string | null;
  workerId: string | null;
  assignedRecruiterUserId: string | null;
}> {
  const { data, error } = await supabase
    .from("job_applications")
    .update({
      assigned_recruiter_user_id: params.assignedRecruiterUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.applicationId)
    .eq("tenant_id", params.tenantId)
    .select("id, worker_id, assigned_recruiter_user_id")
    .maybeSingle();

  if (error) {
    return { error: error.message, workerId: null, assignedRecruiterUserId: null };
  }
  if (!data) {
    return { error: "Application not found", workerId: null, assignedRecruiterUserId: null };
  }

  const workerId =
    typeof data.worker_id === "string" && data.worker_id.trim() ? data.worker_id.trim() : null;
  if (workerId) {
    const workerResult = await updateWorkerAssignee(supabase, {
      tenantId: params.tenantId,
      workerId,
      assignedRecruiterUserId: params.assignedRecruiterUserId,
    });
    if (workerResult.error) {
      return {
        error: workerResult.error,
        workerId,
        assignedRecruiterUserId: data.assigned_recruiter_user_id ?? null,
      };
    }
    // Keep every application for this candidate on the same assignee.
    const appsResult = await updateAllApplicationsAssigneeForWorker(supabase, {
      tenantId: params.tenantId,
      workerId,
      assignedRecruiterUserId: params.assignedRecruiterUserId,
    });
    if (appsResult.error) {
      return {
        error: appsResult.error,
        workerId,
        assignedRecruiterUserId: data.assigned_recruiter_user_id ?? null,
      };
    }
  }

  return {
    error: null,
    workerId,
    assignedRecruiterUserId: data.assigned_recruiter_user_id ?? null,
  };
}

/**
 * For workers missing a direct assignee, use the most recently updated application assignee.
 */
export async function getApplicationAssigneeFallbackByWorker(
  supabase: Sb,
  tenantId: string,
  workerIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ids = [...new Set(workerIds.map((id) => id.trim()).filter(Boolean))];
  if (!tenantId || ids.length === 0) return result;

  const { data, error } = await supabase
    .from("job_applications")
    .select("worker_id, assigned_recruiter_user_id, updated_at")
    .eq("tenant_id", tenantId)
    .in("worker_id", ids)
    .not("assigned_recruiter_user_id", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[sync-recruiter-assignment] application assignee fallback failed", error.message);
    return result;
  }

  for (const row of data ?? []) {
    const workerId =
      typeof (row as { worker_id?: string | null }).worker_id === "string"
        ? String((row as { worker_id: string }).worker_id).trim()
        : "";
    const assigneeId =
      typeof (row as { assigned_recruiter_user_id?: string | null }).assigned_recruiter_user_id ===
      "string"
        ? String((row as { assigned_recruiter_user_id: string }).assigned_recruiter_user_id).trim()
        : "";
    if (!workerId || !assigneeId || result.has(workerId)) continue;
    result.set(workerId, assigneeId);
  }

  return result;
}

/**
 * For applications missing an assignee, use the linked worker assignee.
 */
export async function getWorkerAssigneeFallbackByWorker(
  supabase: Sb,
  tenantId: string,
  workerIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const ids = [...new Set(workerIds.map((id) => id.trim()).filter(Boolean))];
  if (!tenantId || ids.length === 0) return result;

  const { data, error } = await supabase
    .from("worker")
    .select("id, assigned_recruiter_user_id")
    .eq("tenant_id", tenantId)
    .in("id", ids)
    .not("assigned_recruiter_user_id", "is", null);

  if (error) {
    console.warn("[sync-recruiter-assignment] worker assignee fallback failed", error.message);
    return result;
  }

  for (const row of data ?? []) {
    const workerId = typeof row.id === "string" ? row.id.trim() : "";
    const assigneeId =
      typeof row.assigned_recruiter_user_id === "string"
        ? row.assigned_recruiter_user_id.trim()
        : "";
    if (!workerId || !assigneeId) continue;
    result.set(workerId, assigneeId);
  }

  return result;
}
