import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the job application to use for recruiting writes.
 * - Prefer explicit applicationId (must belong to tenant + worker).
 * - Else if the worker has exactly one active application, use it.
 * - Else return null (caller must require applicationId).
 */
export async function resolveApplicationContextForWorker(args: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicationId?: string | null;
}): Promise<{ applicationId: string | null; ambiguous: boolean }> {
  const explicit = args.applicationId?.trim() || null;
  if (explicit) {
    const { data, error } = await args.supabase
      .from("job_applications")
      .select("id")
      .eq("id", explicit)
      .eq("tenant_id", args.tenantId)
      .eq("worker_id", args.workerId)
      .maybeSingle();
    if (error) throw error;
    return { applicationId: data?.id ?? null, ambiguous: false };
  }

  const { data: rows, error } = await args.supabase
    .from("job_applications")
    .select("id")
    .eq("tenant_id", args.tenantId)
    .eq("worker_id", args.workerId)
    .not("status", "in", '("rejected","withdrawn")')
    .order("created_at", { ascending: false })
    .limit(2);

  if (error) throw error;
  const list = rows ?? [];
  if (list.length === 1) {
    return { applicationId: String(list[0].id), ambiguous: false };
  }
  if (list.length > 1) {
    return { applicationId: null, ambiguous: true };
  }
  return { applicationId: null, ambiguous: false };
}
