import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkerContext = {
  workerId: string;
  tenantId: string;
  userId: string;
};

export async function resolveWorkerByApplicantId(
  supabase: SupabaseClient,
  applicantId: string
): Promise<WorkerContext | null> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select("id, tenant_id, user_id")
    .eq("user_id", applicantId)
    .maybeSingle();

  if (error) throw error;
  if (!worker?.id || worker.tenant_id == null) return null;

  return {
    workerId: String(worker.id),
    tenantId: String(worker.tenant_id),
    userId: String(worker.user_id ?? applicantId),
  };
}

export async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .or(`slug.eq.${s},subdomain.eq.${s}`)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : null;
}
