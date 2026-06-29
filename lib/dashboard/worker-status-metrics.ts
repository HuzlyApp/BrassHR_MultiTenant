import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkerStatusMetrics = {
  total: number;
  active: number;
  on_leave: number;
  inactive: number;
  terminated: number;
  applications: number;
  offer_extended: number;
  hires: number;
  pending_workers: number;
};

const EMPTY: WorkerStatusMetrics = {
  total: 0,
  active: 0,
  on_leave: 0,
  inactive: 0,
  terminated: 0,
  applications: 0,
  offer_extended: 0,
  hires: 0,
  pending_workers: 0,
};

export async function fetchWorkerStatusMetrics(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<WorkerStatusMetrics> {
  const { data, error } = await supabase.rpc("worker_status_metrics", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as Partial<WorkerStatusMetrics>;
  return {
    total: Number(row.total ?? 0),
    active: Number(row.active ?? 0),
    on_leave: Number(row.on_leave ?? 0),
    inactive: Number(row.inactive ?? 0),
    terminated: Number(row.terminated ?? 0),
    applications: Number(row.applications ?? 0),
    offer_extended: Number(row.offer_extended ?? 0),
    hires: Number(row.hires ?? 0),
    pending_workers: Number(row.pending_workers ?? 0),
  };
}

export { EMPTY as emptyWorkerStatusMetrics };
