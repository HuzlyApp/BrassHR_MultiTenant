import type { User } from "@supabase/supabase-js";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";

type UserOnboardingRow = {
  id: string;
  tenant_id: string | null;
  role?: string | null;
  god_admin?: boolean | null;
  onboarding_completed?: boolean | null;
  signup_completed_at?: string | null;
  tenant_onboarding_completed_at?: string | null;
};

type UserRoleRow = {
  tenant_id: string | null;
  role?: string | null;
};

export type RecruiterOnboardingStatus = {
  userId: string;
  role: string | null;
  godAdmin: boolean;
  activeTenantId: string | null;
  requestedTenantId: string | null;
  validTenantAccess: boolean;
  tenantOnboardingCompleted: boolean;
  redirectTarget: "/godadmin/tenants" | "/admin_recruiter/dashboard" | "/tenant-onboarding";
};

function metadataFlag(user: User, key: string): boolean {
  const value = (user.app_metadata as Record<string, unknown> | undefined)?.[key];
  return value === true || value === "true";
}

export async function resolveRecruiterOnboardingStatus(
  user: User,
  options?: { tenantSlug?: string | null }
): Promise<RecruiterOnboardingStatus> {
  const sb = createServiceRoleClient();
  if (!sb) {
    throw new Error("Supabase service role is not configured");
  }

  const tenantSlug = options?.tenantSlug?.trim().toLowerCase() || null;
  const requestedTenantId = tenantSlug ? await resolveTenantIdBySlug(sb, tenantSlug) : null;

  const { data: profile, error: profileError } = await sb
    .from("users")
    .select(
      "id, tenant_id, role, god_admin, onboarding_completed, signup_completed_at, tenant_onboarding_completed_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: roleRows, error: roleError } = await sb
    .from("user_roles")
    .select("tenant_id, role")
    .eq("user_id", user.id);

  if (roleError) {
    throw roleError;
  }

  const row = profile as UserOnboardingRow | null;
  const roles = (roleRows ?? []) as UserRoleRow[];
  const godAdmin = isGodAdminUser(user) || row?.god_admin === true;
  const profileTenantId = row?.tenant_id ? String(row.tenant_id) : null;
  const roleForRequestedTenant = requestedTenantId
    ? roles.find((r) => r.tenant_id === requestedTenantId)
    : null;
  const fallbackRole = roles.find((r) => r.tenant_id)?.role ?? row?.role ?? null;
  const requestedTenantResolved = !tenantSlug || Boolean(requestedTenantId);

  const validTenantAccess = Boolean(
    requestedTenantResolved &&
      (godAdmin ||
        !requestedTenantId ||
        profileTenantId === requestedTenantId ||
        roleForRequestedTenant)
  );

  const activeTenantId =
    requestedTenantId && validTenantAccess
      ? requestedTenantId
      : profileTenantId ?? roles.find((r) => r.tenant_id)?.tenant_id ?? null;

  const tenantOnboardingCompleted =
    Boolean(row?.tenant_onboarding_completed_at) ||
    metadataFlag(user, "tenant_onboarding_completed") ||
    row?.onboarding_completed === true;

  const redirectTarget = godAdmin
    ? "/godadmin/tenants"
    : tenantOnboardingCompleted
      ? "/admin_recruiter/dashboard"
      : "/tenant-onboarding";

  return {
    userId: user.id,
    role: roleForRequestedTenant?.role ?? fallbackRole ?? null,
    godAdmin,
    activeTenantId,
    requestedTenantId,
    validTenantAccess,
    tenantOnboardingCompleted,
    redirectTarget,
  };
}
