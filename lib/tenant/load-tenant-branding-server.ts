import { createClient } from "@supabase/supabase-js";
import {
  brandingFromTenantRow,
  type TenantBranding,
  type TenantBrandingRow,
} from "@/lib/tenant/tenant-branding";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

export async function loadTenantBrandingBySlug(slug: string): Promise<TenantBranding> {
  const key = slug.trim().toLowerCase();
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();

  if (!url || !anon || !key) {
    return brandingFromTenantRow(null, key);
  }

  const supabase = createClient(url, anon);
  const { data } = await supabase
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("slug", key)
    .eq("is_active", true)
    .maybeSingle<TenantBrandingRow>();

  return brandingFromTenantRow(data ?? null, key);
}
