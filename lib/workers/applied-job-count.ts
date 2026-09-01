import type { SupabaseClient } from "@supabase/supabase-js";
import { queryInChunks } from "@/lib/supabase/chunked-in-query";

/** Count job applications per worker id within a tenant. */
export async function getAppliedJobCountsByWorker(
  supabase: SupabaseClient,
  tenantId: string | null,
  workerIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (workerIds.length === 0) return counts;

  const { data, error } = await queryInChunks(workerIds, async (chunk) => {
    let query = supabase.from("job_applications").select("worker_id").in("worker_id", chunk);
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
    const result = await query;
    return { data: (result.data ?? []) as Array<{ worker_id?: string | null }>, error: result.error };
  });
  if (error) throw error;

  for (const row of data) {
    const workerId = String((row as { worker_id?: string | null }).worker_id ?? "").trim();
    if (!workerId) continue;
    counts.set(workerId, (counts.get(workerId) ?? 0) + 1);
  }

  return counts;
}

export function appliedJobCountForWorker(
  counts: Map<string, number>,
  workerId: string | null | undefined
): number {
  const id = String(workerId ?? "").trim();
  if (!id) return 1;
  return counts.get(id) ?? 1;
}
