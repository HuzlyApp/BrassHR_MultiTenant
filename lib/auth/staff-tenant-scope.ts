import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { loadStaffUserProfileCached } from "@/lib/auth/staff-user-profile";
import { readValidatedViewAsTenantId } from "@/lib/godadmin/view-as-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sameTenantId(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  if (!left || !right) return false;
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export type StaffTenantScope =
  /** One tenant UUID (JWT / profile / view-as cookie). */
  | { mode: "scoped"; tenantId: string }
  /** Platform admin browsing without a narrowed tenant filter (API applies no tenant eq). */
  | { mode: "all"; tenantId?: undefined };

/** Tenant UUID from JWT setup (`app_metadata.tenant_id`). */
export function tenantIdFromUser(user: User | null): string | null {
  if (!user?.app_metadata || typeof user.app_metadata !== "object") return null;
  const tid = (user.app_metadata as Record<string, unknown>).tenant_id;
  if (tid === undefined || tid === null) return null;
  const s = String(tid).trim();
  return UUID_RE.test(s) ? s : null;
}

async function isGodAdminMerged(user: User): Promise<boolean> {
  if (isGodAdminUser(user)) return true;
  const profile = await loadStaffUserProfileCached(user.id);
  return profile?.god_admin === true;
}

async function tenantIdFromProfilesTable(userId: string): Promise<string | null> {
  const profile = await loadStaffUserProfileCached(userId);
  if (!profile || profile.god_admin) return null;
  if (profile.tenant_id === null) return null;
  const s = profile.tenant_id.trim();
  return UUID_RE.test(s) ? s : null;
}

async function tenantIdFromHostCookieIfMember(params: {
  userId: string;
  jwtTenantId: string | null;
  profileTenantId: string | null;
}): Promise<string | null> {
  try {
    const jar = await cookies();
    const slug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
    if (!slug || slug.length < 2) return null;
    const sb = createServiceRoleClient();
    if (!sb) return null;
    const tenantId = await resolveTenantIdBySlug(sb, slug);
    if (!tenantId) return null;
    if (
      sameTenantId(params.jwtTenantId, tenantId) ||
      sameTenantId(params.profileTenantId, tenantId)
    ) {
      return tenantId.toLowerCase();
    }
    const { data, error } = await sb
      .from("user_roles")
      .select("tenant_id, role, is_active")
      .eq("user_id", params.userId);
    if (error) return null;
    const member = (data ?? []).some((row: { tenant_id?: string | null; role?: string | null; is_active?: boolean | null }) => {
      const parsed = parseAppRole(row.role);
      return (
        sameTenantId(row.tenant_id, tenantId) &&
        row.is_active !== false &&
        parsed != null &&
        isStaffRole(parsed)
      );
    });
    return member ? tenantId.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Resolved tenant scope for list APIs (workers, geo search, …).
 * - Normal staff users: narrowed via JWT `tenant_id`, then `public.users.tenant_id` when missing from JWT.
 * - God admin: narrowed when `view_as_tenant_id` cookie is set; otherwise all tenants (`mode: all`).
 */
export async function resolveStaffTenantScope(authUser: User): Promise<StaffTenantScope> {
  if (process.env.NODE_ENV !== "production") {
    const devTenant = process.env.DEV_BENCHMARK_TENANT_ID?.trim();
    if (devTenant && UUID_RE.test(devTenant)) {
      return { mode: "scoped", tenantId: devTenant };
    }
    const devViewAs = await readValidatedViewAsTenantId();
    if (devViewAs) {
      return { mode: "scoped", tenantId: devViewAs };
    }
  }

  if (await isGodAdminMerged(authUser)) {
    const viewAsId = await readValidatedViewAsTenantId();
    if (viewAsId) {
      return { mode: "scoped", tenantId: viewAsId };
    }
    return { mode: "all" };
  }

  const fromJwt = tenantIdFromUser(authUser);
  const fromDb = await tenantIdFromProfilesTable(authUser.id);
  const fromHost = await tenantIdFromHostCookieIfMember({
    userId: authUser.id,
    jwtTenantId: fromJwt,
    profileTenantId: fromDb,
  });
  if (fromHost) return { mode: "scoped", tenantId: fromHost };
  if (fromJwt) return { mode: "scoped", tenantId: fromJwt };
  return fromDb ? { mode: "scoped", tenantId: fromDb } : { mode: "all" };
}
