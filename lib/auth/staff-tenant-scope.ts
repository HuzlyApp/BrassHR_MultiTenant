import type { User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { loadStaffUserProfileCached } from "@/lib/auth/staff-user-profile";
import { readValidatedViewAsTenantId } from "@/lib/godadmin/view-as-tenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  if (fromJwt) return { mode: "scoped", tenantId: fromJwt };

  const fromDb = await tenantIdFromProfilesTable(authUser.id);
  return fromDb ? { mode: "scoped", tenantId: fromDb } : { mode: "all" };
}
