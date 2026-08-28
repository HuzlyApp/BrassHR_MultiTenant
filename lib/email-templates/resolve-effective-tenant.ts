import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameTenantId, tenantIdFromUser } from "@/lib/auth/staff-tenant-scope";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
import { loadStaffUserProfileCached } from "@/lib/auth/staff-user-profile";
import { readValidatedViewAsTenantId } from "@/lib/godadmin/view-as-tenant";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { resolveTenantIdBySlug } from "@/lib/tenant/resolve-tenant-id-by-slug";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Effective tenant for recruiter admin (matches effective-branding). */
export async function resolveEffectiveAdminTenantId(
  supabase: SupabaseClient,
  params: { userId: string; authUser: User; godAdmin: boolean }
): Promise<string | null> {
  if (params.godAdmin) {
    const viewAsId = await readValidatedViewAsTenantId();
    if (viewAsId) {
      return viewAsId;
    }

    const jar = await cookies();
    const onboardingSlug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
    if (onboardingSlug && onboardingSlug.length >= 2) {
      const fromSlug = await resolveTenantIdBySlug(supabase, onboardingSlug);
      if (fromSlug) return fromSlug.toLowerCase();
    }

    return null;
  }

  const jar = await cookies();
  const onboardingSlug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
  const fromJwt = tenantIdFromUser(params.authUser);
  const profile = await loadStaffUserProfileCached(params.userId);
  const profileTenantId =
    profile?.tenant_id && UUID_RE.test(profile.tenant_id) ? profile.tenant_id.toLowerCase() : null;

  if (onboardingSlug && onboardingSlug.length >= 2) {
    const fromSlug = await resolveTenantIdBySlug(supabase, onboardingSlug);
    if (fromSlug) {
      if (sameTenantId(fromJwt, fromSlug) || sameTenantId(profileTenantId, fromSlug)) {
        return fromSlug.toLowerCase();
      }
      const { data } = await supabase
        .from("user_roles")
        .select("tenant_id, role, is_active")
        .eq("user_id", params.userId);
      const member = (data ?? []).some(
        (row: { tenant_id?: string | null; role?: string | null; is_active?: boolean | null }) => {
          const parsed = parseAppRole(row.role);
          return (
            sameTenantId(row.tenant_id, fromSlug) &&
            row.is_active !== false &&
            parsed != null &&
            isStaffRole(parsed)
          );
        }
      );
      if (member) return fromSlug.toLowerCase();
    }
  }

  if (fromJwt) return fromJwt;
  return profileTenantId;
}
