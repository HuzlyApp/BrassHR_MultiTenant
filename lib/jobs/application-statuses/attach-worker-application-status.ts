import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkerApplicationStatusSummary = {
  applicationId: string;
  statusId: string | null;
  statusName: string | null;
  systemKey: string | null;
  jobTitle: string | null;
  ambiguous: boolean;
};

type AppRow = {
  id: string;
  worker_id: string | null;
  status: string | null;
  status_id: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  application_statuses:
    | { id: string; name: string; system_key: string | null }
    | { id: string; name: string; system_key: string | null }[]
    | null;
  job_requisitions:
    | { public_title: string | null }
    | { public_title: string | null }[]
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapAppRow(row: AppRow, ambiguous: boolean): WorkerApplicationStatusSummary {
  const status = one(row.application_statuses);
  const job = one(row.job_requisitions);
  return {
    applicationId: row.id,
    statusId: status?.id ?? row.status_id,
    statusName: status?.name ?? null,
    systemKey: status?.system_key ?? row.status,
    jobTitle: job?.public_title ?? null,
    ambiguous,
  };
}

/**
 * For each worker, pick the latest active job application and its admin-managed status.
 * If a worker has multiple active applications, returns the newest and marks ambiguous.
 */
export async function getApplicationStatusSummariesForWorkers(
  supabase: SupabaseClient,
  args: { tenantId?: string | null; workerIds: string[] }
): Promise<Map<string, WorkerApplicationStatusSummary>> {
  const workerIds = Array.from(new Set(args.workerIds.filter(Boolean)));
  const result = new Map<string, WorkerApplicationStatusSummary>();
  if (workerIds.length === 0) return result;

  let query = supabase
    .from("job_applications")
    .select(
      "id, worker_id, status, status_id, updated_at, created_at, application_statuses(id, name, system_key), job_requisitions(public_title)"
    )
    .in("worker_id", workerIds)
    .not("status", "in", '("rejected","withdrawn")')
    .order("updated_at", { ascending: false });

  if (args.tenantId) {
    query = query.eq("tenant_id", args.tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const byWorker = new Map<string, AppRow[]>();
  for (const row of (data ?? []) as AppRow[]) {
    const workerId = row.worker_id?.trim();
    if (!workerId) continue;
    const list = byWorker.get(workerId) ?? [];
    list.push(row);
    byWorker.set(workerId, list);
  }

  for (const [workerId, apps] of byWorker) {
    const sorted = [...apps].sort((a, b) => {
      const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
      const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });
    const newest = sorted[0];
    if (!newest) continue;
    result.set(workerId, mapAppRow(newest, sorted.length > 1));
  }

  return result;
}

export async function getApplicationStatusSummaryForWorker(
  supabase: SupabaseClient,
  args: { tenantId: string; workerId: string }
): Promise<WorkerApplicationStatusSummary | null> {
  const map = await getApplicationStatusSummariesForWorkers(supabase, {
    tenantId: args.tenantId,
    workerIds: [args.workerId],
  });
  return map.get(args.workerId) ?? null;
}
