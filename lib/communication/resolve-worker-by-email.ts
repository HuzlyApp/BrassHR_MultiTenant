import type { SupabaseClient } from "@supabase/supabase-js";
import { emailLookupVariants, extractBareEmailAddress } from "@/lib/email/email-domain";

export type WorkerEmailMatch = {
  id: string;
  tenant_id: string;
  email: string | null;
};

/**
 * Resolve a worker by email, matching both @brasshr.com and legacy @nexusmedpro.com
 * addresses so Communication History and inbound sync stay linked after domain migration.
 */
export async function resolveWorkerByEmail(
  supabase: SupabaseClient,
  rawEmail: string,
  tenantId?: string | null
): Promise<WorkerEmailMatch | null> {
  const bare = extractBareEmailAddress(rawEmail);
  const variants = emailLookupVariants(bare);
  if (variants.length === 0) return null;

  let query = supabase
    .from("worker")
    .select("id, tenant_id, email")
    .in("email", variants)
    .not("tenant_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data: workerRow, error: workerError } = await query.maybeSingle();
  if (workerError) throw workerError;
  if (workerRow?.id && workerRow.tenant_id) {
    return workerRow as WorkerEmailMatch;
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email")
    .in("email", variants)
    .limit(5);

  if (usersError) throw usersError;
  const userIds = (users ?? []).map((u) => String((u as { id: string }).id)).filter(Boolean);
  if (userIds.length === 0) return null;

  let byUserQuery = supabase
    .from("worker")
    .select("id, tenant_id, email")
    .in("user_id", userIds)
    .not("tenant_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (tenantId) byUserQuery = byUserQuery.eq("tenant_id", tenantId);

  const { data: linkedWorker, error: linkedError } = await byUserQuery.maybeSingle();
  if (linkedError) throw linkedError;
  if (!linkedWorker?.id || !linkedWorker.tenant_id) return null;

  return linkedWorker as WorkerEmailMatch;
}
