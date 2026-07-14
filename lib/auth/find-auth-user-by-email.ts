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

  const { data: staffRow } = await svc
    .from("users")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (staffRow?.id) candidateIds.add(String(staffRow.id));

  const { data: workerRow } = await svc
    .from("worker")
    .select("user_id")
    .ilike("email", email)
    .not("user_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (workerRow?.user_id) candidateIds.add(String(workerRow.user_id));

  for (const userId of candidateIds) {
    const { data, error } = await svc.auth.admin.getUserById(userId);
    if (error || !data.user) continue;
    const authEmail = data.user.email?.trim().toLowerCase() ?? "";
    if (!authEmail || authEmail === email) {
      return data.user.id;
    }
  }

  return null;
}
