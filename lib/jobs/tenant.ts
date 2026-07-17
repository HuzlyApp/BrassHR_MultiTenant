import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffApiAuthContext } from "@/lib/auth/api-session";
import { resolveEffectiveAdminTenantId } from "@/lib/email-templates/resolve-effective-tenant";

export async function resolveStaffTenantId(
  supabase: SupabaseClient,
  auth: StaffApiAuthContext
): Promise<string | null> {
  return resolveEffectiveAdminTenantId(supabase, {
    userId: auth.userId,
    authUser: auth.authUser,
    godAdmin: auth.godAdmin,
  });
}

export async function resolvePublicTenant(
  supabase: SupabaseClient,
  slugInput: string | null | undefined
): Promise<{ id: string; slug: string; name: string } | null> {
  const slug = slugInput?.trim().toLowerCase();
  if (!slug) return null;

  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, subdomain, name, is_active")
    .or(`slug.eq.${slug},subdomain.eq.${slug}`)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) return null;

  return {
    id: String(data.id),
    slug: String(data.slug ?? data.subdomain ?? slug).toLowerCase(),
    name: String(data.name ?? "Careers"),
  };
}
