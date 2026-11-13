import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

/** Tenant from `onboarding_tenant_slug` cookie (no membership check). */
async function tenantIdFromHostCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    const slug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
    if (!slug || slug.length < 2) return null;
    const sb = createServiceRoleClient();
    if (!sb) return null;
    const tenantId = await resolveTenantIdBySlug(sb, slug);
    return tenantId ? tenantId.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Resolved tenant scope for list APIs (workers, geo search, …).
 * - Normal staff users: current database profile and active tenant membership.
 * - God admin: narrowed when `view_as_tenant_id` cookie is set; otherwise host slug, else all tenants.
 * - Dev / bypass: also honor host slug without membership so Candidates search can page via RPC.
 */
export async function resolveStaffTenantScope(authUser: User): Promise<StaffTenantScope> {
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_AUTH_BYPASS === "true") {
    const devTenant = process.env.DEV_BENCHMARK_TENANT_ID?.trim();
    if (devTenant && UUID_RE.test(devTenant)) {
      return { mode: "scoped", tenantId: devTenant };
    }
    const devViewAs = await readValidatedViewAsTenantId();
    if (devViewAs) {
      return { mode: "scoped", tenantId: devViewAs };
    }
    // Local branded hosts set onboarding_tenant_slug; DEV_ADMIN_AUTH_BYPASS has no users row
    // so membership checks never pass — still scope so list/search RPCs get a tenant.
    const fromHostDev = await tenantIdFromHostCookie();
    if (fromHostDev) {
      return { mode: "scoped", tenantId: fromHostDev };
    }
  }

  if (await isGodAdminMerged(authUser)) {
    const viewAsId = await readValidatedViewAsTenantId();
    if (viewAsId) {
      return { mode: "scoped", tenantId: viewAsId };
    }
    const fromHostGod = await tenantIdFromHostCookie();
    if (fromHostGod) {
      return { mode: "scoped", tenantId: fromHostGod };
    }
    return { mode: "all" };
  }

  const svc = createServiceRoleClient();
  if (!svc) throw new Error("Tenant scope unavailable");
  const { resolveEffectiveAdminTenantId } = await import("@/lib/email-templates/resolve-effective-tenant");
  const tenantId = await resolveEffectiveAdminTenantId(svc, { userId: authUser.id, authUser, godAdmin: false });
  if (!tenantId) throw new Error("No authorized tenant selected");
  return { mode: "scoped", tenantId };
}
