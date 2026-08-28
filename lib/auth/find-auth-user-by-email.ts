import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";

/**
 * Resolves an auth user id for password recovery without calling generateLink
 * (which consumes Supabase's recovery rate limit).
 */
export async function findAuthUserIdByEmail(
  svc: SupabaseClient,
  emailInput: string
): Promise<string | null> {
  const email = normalizeTenantEmail(emailInput);
  if (!email.includes("@")) return null;

  const candidateIds = new Set<string>();

  const { data: staffRows } = await svc.from("users").select("id").ilike("email", email);
  for (const row of staffRows ?? []) {
    if (row?.id) candidateIds.add(String(row.id));
  }

  const { data: workerRows } = await svc
    .from("worker")
    .select("user_id")
    .ilike("email", email)
    .not("user_id", "is", null);
  for (const row of workerRows ?? []) {
    if (row?.user_id) candidateIds.add(String(row.user_id));
  }

  for (const userId of candidateIds) {
    const { data, error } = await svc.auth.admin.getUserById(userId);
    if (error || !data.user) continue;
    const authEmail = data.user.email?.trim().toLowerCase() ?? "";
    // Never attach an invite/password reset to a different auth identity,
    // including accounts whose Auth email is missing.
    if (authEmail === email) {
      return data.user.id;
    }
  }

  return null;
}
