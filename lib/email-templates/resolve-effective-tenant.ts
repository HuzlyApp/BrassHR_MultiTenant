import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sameTenantId } from "@/lib/auth/staff-tenant-scope";
import { isStaffRole, parseAppRole } from "@/lib/auth/app-role";
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
  const slug = jar.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
  const { data: profile, error: profileError } = await supabase.from("users")
    .select("tenant_id,role,is_active").eq("id", params.userId).maybeSingle();
  if (profileError || !profile || profile.is_active === false) return null;
  const selected = slug ? await resolveTenantIdBySlug(supabase, slug) : profile.tenant_id;
  if (!selected || !UUID_RE.test(selected)) return null;
  const { data: membership, error } = await supabase.from("user_roles")
    .select("role,is_active").eq("user_id", params.userId).eq("tenant_id", selected).maybeSingle();
  if (error || membership?.is_active === false) return null;
  const role = parseAppRole(membership?.role ?? (sameTenantId(profile.tenant_id, selected) ? profile.role : null));
  return role && isStaffRole(role) ? selected.toLowerCase() : null;
}
