import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseAppRole, type AppRole } from "@/lib/auth/app-role";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";

/** Current tenant membership is authoritative; JWT roles cannot defeat revocation. */
export async function resolveAppRoleForUser(user: User): Promise<AppRole> {
  const sb = createServiceRoleClient();
  if (!sb || user.is_anonymous) return "worker";
  const { data: profile, error } = await sb.from("users")
    .select("role,tenant_id,is_active,god_admin").eq("id", user.id).maybeSingle();
  if (error || !profile || profile.is_active === false) return "worker";
  if (profile.god_admin === true) return "admin";
  const tenantId = await resolveEffectiveAdminTenantId(sb, { userId: user.id, authUser: user, godAdmin: false });
  if (!tenantId) return "worker";
  const { data: membership, error: memberError } = await sb.from("user_roles")
    .select("role,is_active").eq("user_id", user.id).eq("tenant_id", tenantId).maybeSingle();
  if (memberError || membership?.is_active === false) return "worker";
  return parseAppRole(membership?.role ?? (profile.tenant_id === tenantId ? profile.role : null)) ?? "worker";
}
