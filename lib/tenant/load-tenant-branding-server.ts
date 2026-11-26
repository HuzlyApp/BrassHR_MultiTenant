import { createClient } from "@supabase/supabase-js";
import {
  brandingFromTenantRow,
  type TenantBranding,
  type TenantBrandingRow,
} from "@/lib/tenant/tenant-branding";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

/**
 * Load public branding for a `?tenant=` label.
 * Labels may be either `tenants.slug` or `tenants.subdomain` (Launch Pad preview
 * often passes subdomain while jobs APIs resolve both).
 */
export async function loadTenantBrandingBySlug(slug: string): Promise<TenantBranding> {
  const key = slug.trim().toLowerCase();
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();

  if (!url || !anon || !key) {
    return brandingFromTenantRow(null, key);
  }

  const supabase = createClient(url, anon);
  const { data: bySlug } = await supabase
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("slug", key)
    .eq("is_active", true)
    .maybeSingle<TenantBrandingRow>();

  if (bySlug) {
    return brandingFromTenantRow(bySlug, key);
  }

  const { data: bySubdomain } = await supabase
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("subdomain", key)
    .eq("is_active", true)
    .maybeSingle<TenantBrandingRow>();

  return brandingFromTenantRow(bySubdomain ?? null, bySubdomain?.slug ?? key);
}
