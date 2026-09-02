import type { User } from "@supabase/supabase-js";
import { ADMIN_RECRUITER_HOME_ROUTE } from "@/app/admin_recruiter/components/sidebar-config";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { fetchTenantVanityLabel } from "@/lib/auth/recruiter-dashboard-redirect";
import { sameTenantId } from "@/lib/auth/staff-tenant-scope";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";
import { resolveTenantIdBySlugUncached } from "@/lib/tenant/resolve-tenant-id-by-slug";

type UserOnboardingRow = {
  id: string;
  tenant_id: string | null;
  role?: string | null;
  god_admin?: boolean | null;
  is_active?: boolean | null;
  onboarding_completed?: boolean | null;
  signup_completed_at?: string | null;
  tenant_onboarding_completed_at?: string | null;
};

type UserRoleRow = {
  user_id?: string | null;
  tenant_id: string | null;
  role?: string | null;
  is_active?: boolean | null;
};

export type RecruiterOnboardingStatus = {
  userId: string;
  role: string | null;
  godAdmin: boolean;
  activeTenantId: string | null;
  requestedTenantId: string | null;
  validTenantAccess: boolean;
  tenantOnboardingCompleted: boolean;
  tenantSubdomain: string | null;
  redirectTarget: "/godadmin/tenants" | typeof ADMIN_RECRUITER_HOME_ROUTE | "/tenant-onboarding";
};

function metadataFlag(user: User, key: string): boolean {
  const value = (user.app_metadata as Record<string, unknown> | undefined)?.[key];
  return value === true || value === "true";
}

function isActiveStaffRole(role: string | null | undefined): boolean {
  const parsed = parseAppRole(role);
  return parsed != null && isStaffRole(parsed);
}

export function staffHasTenantMembership(params: {
  requestedTenantId: string | null;
  profileTenantId: string | null;
  roleRows: Array<{ tenant_id?: string | null; role?: string | null; is_active?: boolean | null }>;
}): boolean {
  if (!params.requestedTenantId) return true;
  if (sameTenantId(params.profileTenantId, params.requestedTenantId)) return true;
  return params.roleRows.some(
    (row) =>
      sameTenantId(row.tenant_id, params.requestedTenantId) &&
      row.is_active !== false &&
      isActiveStaffRole(row.role)
  );
}

/** Home tenant for staff who land on the wrong host or an unknown ?tenant= slug. */
export function homeStaffTenantId(params: {
  profileTenantId: string | null;
  profileRole?: string | null;
  profileActive?: boolean | null;
  roleRows: Array<{ tenant_id?: string | null; role?: string | null; is_active?: boolean | null }>;
}): string | null {
  if (
    params.profileTenantId &&
    params.profileActive !== false &&
    isActiveStaffRole(params.profileRole)
  ) {
    return params.profileTenantId;
  }
  const row = params.roleRows.find(
    (item) => item.tenant_id && item.is_active !== false && isActiveStaffRole(item.role)
  );
  return row?.tenant_id ? String(row.tenant_id) : null;
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
  let requestedTenantId = tenantSlug ? await resolveTenantIdBySlugUncached(sb, tenantSlug) : null;

  const { data: profile, error: profileError } = await sb
    .from("users")
    .select(
      "id, tenant_id, role, god_admin, is_active, onboarding_completed, signup_completed_at, tenant_onboarding_completed_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: roleRows, error: roleError } = await sb
    .from("user_roles")
    .select("user_id, tenant_id, role, is_active")
    .eq("user_id", user.id);

  if (roleError) {
    throw roleError;
  }

  const row = profile as UserOnboardingRow | null;
  let roles = (roleRows ?? []) as UserRoleRow[];
  const godAdmin = isGodAdminUser(user) || row?.god_admin === true;
  const profileTenantId = row?.tenant_id ? String(row.tenant_id) : null;
  let memberOfRequested = staffHasTenantMembership({
    requestedTenantId,
    profileTenantId,
    roleRows: roles,
  });

  const authEmail = typeof user.email === "string" ? normalizeTenantEmail(user.email) : "";
  if (!memberOfRequested && !godAdmin && requestedTenantId && authEmail.includes("@")) {
    const { data: emailProfiles, error: emailError } = await sb
      .from("users")
      .select("id, tenant_id, role, is_active")
      .ilike("email", authEmail);
    if (emailError) throw emailError;

    const emailRows = (emailProfiles ?? []) as UserOnboardingRow[];
    const emailIds = [...new Set(emailRows.map((item) => item.id).filter(Boolean))];
    if (emailIds.length > 0) {
      const { data: emailRoles, error: emailRoleError } = await sb
        .from("user_roles")
        .select("user_id, tenant_id, role, is_active")
        .in("user_id", emailIds);
      if (emailRoleError) throw emailRoleError;
      const extraRoles = (emailRoles ?? []) as UserRoleRow[];
      roles = [...roles, ...extraRoles];
      memberOfRequested = emailRows.some(
        (item) =>
          item.is_active !== false &&
          sameTenantId(item.tenant_id, requestedTenantId) &&
          isActiveStaffRole(item.role)
      ) ||
        staffHasTenantMembership({
          requestedTenantId,
          profileTenantId: null,
          roleRows: extraRoles,
        });
    }
  }

  const homeTenantId = homeStaffTenantId({
    profileTenantId,
    profileRole: row?.role ?? null,
    profileActive: row?.is_active,
    roleRows: roles,
  });

  if (tenantSlug && !memberOfRequested) {
    const candidateIds = [
      ...new Set(
        [profileTenantId, homeTenantId, ...roles.map((item) => item.tenant_id)]
          .filter((id): id is string => Boolean(id))
          .map((id) => String(id))
      ),
    ];
    if (candidateIds.length > 0) {
      const { data: ownedTenants, error: ownedError } = await sb
        .from("tenants")
        .select("id, slug, subdomain")
        .in("id", candidateIds)
        .eq("is_active", true);
      if (ownedError) throw ownedError;
      const slugMatch = (ownedTenants ?? []).find((tenant) => {
        const slug = String(tenant.slug ?? "").trim().toLowerCase();
        const subdomain = String(tenant.subdomain ?? "").trim().toLowerCase();
        return slug === tenantSlug || subdomain === tenantSlug;
      });
      if (slugMatch?.id) {
        requestedTenantId = String(slugMatch.id);
        memberOfRequested = true;
      }
    }
  }

  const validTenantAccess = Boolean(
    godAdmin || !tenantSlug || memberOfRequested || homeTenantId
  );

  const roleForRequestedTenant =
    requestedTenantId && memberOfRequested
      ? roles.find(
          (r) => sameTenantId(r.tenant_id, requestedTenantId) && r.is_active !== false
        )
      : null;
  const fallbackRole = roles.find((r) => r.tenant_id)?.role ?? row?.role ?? null;

  const activeTenantId = godAdmin
    ? requestedTenantId ?? homeTenantId ?? profileTenantId
    : requestedTenantId && memberOfRequested
      ? requestedTenantId
      : homeTenantId ?? profileTenantId ?? roles.find((r) => r.tenant_id)?.tenant_id ?? null;

  const tenantOnboardingCompleted =
    Boolean(row?.tenant_onboarding_completed_at) ||
    metadataFlag(user, "tenant_onboarding_completed") ||
    row?.onboarding_completed === true;

  const redirectTarget = godAdmin
    ? "/godadmin/tenants"
    : tenantOnboardingCompleted
      ? ADMIN_RECRUITER_HOME_ROUTE
      : "/tenant-onboarding";

  let tenantSubdomain: string | null = null;
  if (!godAdmin && activeTenantId) {
    tenantSubdomain = await fetchTenantVanityLabel(sb, activeTenantId);
  }

  return {
    userId: user.id,
    role: roleForRequestedTenant?.role ?? fallbackRole ?? null,
    godAdmin,
    activeTenantId,
    requestedTenantId,
    validTenantAccess,
    tenantOnboardingCompleted,
    tenantSubdomain,
    redirectTarget,
  };
}
