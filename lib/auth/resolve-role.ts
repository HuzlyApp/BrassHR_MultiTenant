import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isStaffRole, parseAppRole, roleAtLeast, type AppRole } from "@/lib/auth/app-role";

function bestRoleFromRows(rows: { role?: string }[] | null | undefined): AppRole | null {
  if (!rows?.length) return null;
  let best: AppRole = "worker";
  for (const row of rows) {
    const r = parseAppRole(row.role);
    if (!r) continue;
    best = roleAtLeast(r, best) ? r : best;
  }
  return best;
}

/**
 * Resolve `app_role`: JWT `app_metadata.role`, then `user_roles` (tenant-scoped, then any),
 * then `public.users` (god_admin / tenant_id). Defaults to `worker`.
 */
export async function resolveAppRoleForUser(user: User): Promise<AppRole> {
  const md = user.app_metadata as Record<string, unknown> | undefined;
  const jwtRole = parseAppRole(md?.role);
  if (jwtRole && isStaffRole(jwtRole)) return jwtRole;

  const tenantId =
    md?.tenant_id !== undefined && md.tenant_id !== null && String(md.tenant_id).trim() !== ""
      ? String(md.tenant_id).trim()
      : null;

  const sb = createServiceRoleClient();
  if (sb) {
    if (tenantId) {
      const { data, error } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId);
      if (!error) {
        const scoped = bestRoleFromRows(data as { role?: string }[]);
        if (scoped && isStaffRole(scoped)) return scoped;
      }
    }

    const { data: allRows, error: allErr } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!allErr) {
      const fromRoles = bestRoleFromRows(allRows as { role?: string }[]);
      if (fromRoles && isStaffRole(fromRoles)) return fromRoles;
      if (fromRoles && !jwtRole) return fromRoles;
    }

    const { data: profile } = await sb
      .from("users")
      .select("god_admin, tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const row = profile as { god_admin?: boolean; tenant_id?: string | null } | null;
    if (row?.god_admin === true) return "admin";
    if (row?.tenant_id && String(row.tenant_id).trim()) return "recruiter";
  }

  if (jwtRole) return jwtRole;
  return "worker";
}
