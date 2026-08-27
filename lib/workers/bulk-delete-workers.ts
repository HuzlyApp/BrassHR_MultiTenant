import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBulkDeleteIds } from "@/lib/jobs/service";

type DbClient = SupabaseClient;

type BulkDeleteWorkerRow = {
  deleted_id?: string | null;
};

/**
 * Permanently remove workers (candidates) for a tenant.
 * Uses a single database transaction so linked applications are not deleted
 * unless the worker delete also succeeds.
 */
export async function bulkDeleteWorkers(
  supabase: DbClient,
  tenantId: string,
  ids: string[]
): Promise<{ deletedIds: string[] }> {
  const normalized = parseBulkDeleteIds(ids);
  if (!normalized.length) return { deletedIds: [] };

  const { data, error } = await supabase.rpc("bulk_delete_workers", {
    p_tenant_id: tenantId,
    p_worker_ids: normalized,
  });

  if (error) throw error;

  const deletedIds = ((data ?? []) as BulkDeleteWorkerRow[])
    .map((row) => String(row.deleted_id ?? "").trim())
    .filter(Boolean);

  return { deletedIds };
}
