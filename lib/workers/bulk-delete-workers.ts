import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBulkDeleteIds } from "@/lib/jobs/service";

type DbClient = SupabaseClient;

/**
 * Permanently remove workers (candidates) for a tenant.
 * Linked job applications are removed first so FK RESTRICT does not block the delete.
 */
export async function bulkDeleteWorkers(
  supabase: DbClient,
  tenantId: string,
  ids: string[]
): Promise<{ deletedIds: string[] }> {
  const normalized = parseBulkDeleteIds(ids);
  if (!normalized.length) return { deletedIds: [] };

  const { error: applicationsError } = await supabase
    .from("job_applications")
    .delete()
    .in("worker_id", normalized)
    .eq("tenant_id", tenantId);

  if (applicationsError) throw applicationsError;

  const { data, error } = await supabase
    .from("worker")
    .delete()
    .in("id", normalized)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) throw error;
  return { deletedIds: (data ?? []).map((row) => String(row.id)) };
}
