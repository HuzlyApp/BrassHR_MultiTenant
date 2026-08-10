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
    .order("updated_at", { ascending: false });

  if (tenantId) {
    query = query.eq("tenant_id", tenantId).limit(1);
    const { data: workerRow, error: workerError } = await query.maybeSingle();
    if (workerError) throw workerError;
    if (workerRow?.id && workerRow.tenant_id) {
      return workerRow as WorkerEmailMatch;
    }
  } else {
    // Unscoped: only resolve when exactly one tenant worker matches; otherwise leave unresolved
    // to avoid cross-tenant mis-association for inbound email/SMS.
    const { data: rows, error: workerError } = await query.limit(2);
    if (workerError) throw workerError;
    if ((rows?.length ?? 0) === 1 && rows?.[0]?.id && rows[0].tenant_id) {
      return rows[0] as WorkerEmailMatch;
    }
    if ((rows?.length ?? 0) > 1) {
      return null;
    }
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
    .order("updated_at", { ascending: false });

  if (tenantId) {
    const { data: linkedWorker, error: linkedError } = await byUserQuery
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    if (linkedError) throw linkedError;
    if (!linkedWorker?.id || !linkedWorker.tenant_id) return null;
    return linkedWorker as WorkerEmailMatch;
  }

  const { data: linkedRows, error: linkedError } = await byUserQuery.limit(2);
  if (linkedError) throw linkedError;
  if ((linkedRows?.length ?? 0) === 1 && linkedRows?.[0]?.id && linkedRows[0].tenant_id) {
    return linkedRows[0] as WorkerEmailMatch;
  }
  return null;
}
