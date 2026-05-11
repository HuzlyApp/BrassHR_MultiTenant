import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseAppRole, roleAtLeast, type AppRole } from "@/lib/auth/app-role";

/**
 * Resolve `app_role`: prefer Auth JWT `app_metadata.role` (set server-side), then `user_roles`,
 * optionally scoped by `app_metadata.tenant_id`. Fallback `worker`.
 */
export async function resolveAppRoleForUser(user: User): Promise<AppRole> {
  const md = user.app_metadata as Record<string, unknown> | undefined;
  const jwtRole = parseAppRole(md?.role);
  if (jwtRole) return jwtRole;

  const tenantId =
    md?.tenant_id !== undefined && md.tenant_id !== null && String(md.tenant_id).trim() !== ""
      ? String(md.tenant_id).trim()
      : null;

  const sb = createServiceRoleClient();
  if (sb) {
    let q = sb.from("user_roles").select("role").eq("user_id", user.id);
    if (tenantId) q = q.eq("tenant_id", tenantId);

    const { data, error } = await q;
    if (!error && Array.isArray(data) && data.length > 0) {
      let best: AppRole = "worker";
      for (const row of data) {
        const r = parseAppRole((row as { role?: string }).role);
        if (!r) continue;
        best = roleAtLeast(r, best) ? r : best;
      }
      return best;
    }
  }

  return "worker";
}
