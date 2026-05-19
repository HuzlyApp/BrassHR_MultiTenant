import type { SupabaseClient } from "@supabase/supabase-js";

export async function lookupTenantSlugBySubdomain(
  client: SupabaseClient,
  subdomainLabel: string
): Promise<string | null> {
  const label = subdomainLabel.trim().toLowerCase();
  if (!label) return null;
  const { data, error } = await client
    .from("tenants")
    .select("slug")
    .eq("subdomain", label)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data?.slug) return null;
  return String(data.slug);
}
