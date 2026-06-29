import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdFromUser } from "@/lib/auth/staff-tenant-scope";
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

  const fromJwt = tenantIdFromUser(params.authUser);
  if (fromJwt) return fromJwt;

  const profile = await loadStaffUserProfileCached(params.userId);
  if (profile?.tenant_id && UUID_RE.test(profile.tenant_id)) {
    return profile.tenant_id.toLowerCase();
  }
  return null;
}
