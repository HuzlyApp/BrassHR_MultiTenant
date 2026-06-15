import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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

function metadataFlag(user: User, key: string): boolean {
  const value = (user.app_metadata as Record<string, unknown> | undefined)?.[key];
  return value === true || value === "true";
}

function roleFromProfileRow(row: {
  god_admin?: boolean;
  tenant_id?: string | null;
  role?: string | null;
} | null): AppRole | null {
  if (!row) return null;
  if (row.god_admin === true) return "admin";
  return parseAppRole(row.role);
}

async function resolveRoleFromSessionProfile(userId: string): Promise<AppRole | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .select("god_admin, tenant_id, role")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      if (process.env.AUTH_DEBUG === "true") {
        console.warn("[resolve-role] session profile lookup failed", error.message);
      }
      return null;
    }
    return roleFromProfileRow(data as { god_admin?: boolean; tenant_id?: string | null; role?: string | null });
  } catch {
    return null;
  }
}

/**
 * Resolve `app_role` from JWT metadata, `user_roles`, and `public.users`
 * (`role`, `god_admin`, `tenant_id`). Returns the highest-ranked role found.
 */
export async function resolveAppRoleForUser(user: User): Promise<AppRole> {
  const md = user.app_metadata as Record<string, unknown> | undefined;
  const jwtRole = parseAppRole(md?.role);

  let best: AppRole = jwtRole ?? "worker";

  const jwtTenantId =
    md?.tenant_id !== undefined && md.tenant_id !== null && String(md.tenant_id).trim() !== ""
      ? String(md.tenant_id).trim()
      : null;

  const sb = createServiceRoleClient();
  let profileTenantId: string | null = null;

  if (sb) {
    const { data: profile, error: profileError } = await sb
      .from("users")
      .select("god_admin, tenant_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError && process.env.AUTH_DEBUG === "true") {
      console.warn("[resolve-role] service profile lookup failed", profileError.message);
    }

    const row = profile as {
      god_admin?: boolean;
      tenant_id?: string | null;
      role?: string | null;
    } | null;

    if (row?.god_admin === true) {
      return "admin";
    }

    const profileRole = roleFromProfileRow(row);
    if (profileRole && roleAtLeast(profileRole, best)) {
      best = profileRole;
    }

    profileTenantId =
      row?.tenant_id != null && String(row.tenant_id).trim() !== ""
        ? String(row.tenant_id).trim()
        : null;

    const scopedTenantId = jwtTenantId ?? profileTenantId;

    if (scopedTenantId) {
      const { data, error } = await sb
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", scopedTenantId);
      if (!error) {
        const scoped = bestRoleFromRows(data as { role?: string }[]);
        if (scoped && roleAtLeast(scoped, best)) best = scoped;
      }
    }

    const { data: allRows, error: allErr } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!allErr) {
      const fromRoles = bestRoleFromRows(allRows as { role?: string }[]);
      if (fromRoles && roleAtLeast(fromRoles, best)) best = fromRoles;
    }
  }

  if (!isStaffRole(best)) {
    const sessionRole = await resolveRoleFromSessionProfile(user.id);
    if (sessionRole && roleAtLeast(sessionRole, best)) {
      best = sessionRole;
      if (!profileTenantId) {
        const supabase = await createClient();
        const { data } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .maybeSingle();
        const tid = (data as { tenant_id?: string | null } | null)?.tenant_id;
        profileTenantId = tid != null && String(tid).trim() !== "" ? String(tid).trim() : null;
      }
    }
  }

  // Tenant owners who finished onboarding are staff even when JWT still says worker.
  if (!isStaffRole(best) && metadataFlag(user, "tenant_onboarding_completed")) {
    best = "admin";
  }

  if (!isStaffRole(best) && profileTenantId) {
    if (roleAtLeast("recruiter", best)) best = "recruiter";
  }

  return best;
}
