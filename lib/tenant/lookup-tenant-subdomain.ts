import type { SupabaseClient } from "@supabase/supabase-js";

export async function lookupTenantSlugBySubdomain(
  client: SupabaseClient,
  subdomainLabel: string
): Promise<string | null> {
  const label = subdomainLabel.trim().toLowerCase();
  if (!label) return null;
  const { data: bySubdomain, error: subErr } = await client
    .from("tenants")
    .select("slug")
    .eq("subdomain", label)
    .eq("is_active", true)
    .maybeSingle();

  if (subErr) return null;
  if (bySubdomain?.slug) return String(bySubdomain.slug);

  const { data: bySlug, error: slugErr } = await client
    .from("tenants")
    .select("slug")
    .eq("slug", label)
    .eq("is_active", true)
    .maybeSingle();

  if (slugErr || !bySlug?.slug) return null;
  return String(bySlug.slug);
}
