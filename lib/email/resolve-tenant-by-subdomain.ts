import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantBySubdomain = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
};

/**
 * Resolve tenant by vanity subdomain label (e.g. test → test.brasshr.com).
 * Falls back to slug when subdomain is unset.
 */
export async function resolveTenantBySubdomain(
  supabase: SupabaseClient,
  subdomainLabel: string
): Promise<TenantBySubdomain | null> {
  const label = subdomainLabel.trim().toLowerCase();
  if (!label) return null;

  const { data: bySubdomain, error: subErr } = await supabase
    .from("tenants")
    .select("id, name, slug, subdomain")
    .eq("subdomain", label)
    .eq("is_active", true)
    .maybeSingle();

  if (subErr) throw subErr;
  if (bySubdomain?.id) {
    return {
      id: String(bySubdomain.id),
      name: String(bySubdomain.name ?? label),
      slug: String(bySubdomain.slug),
      subdomain: bySubdomain.subdomain == null ? null : String(bySubdomain.subdomain),
    };
  }

  const { data: bySlug, error: slugErr } = await supabase
    .from("tenants")
    .select("id, name, slug, subdomain")
    .eq("slug", label)
    .eq("is_active", true)
    .maybeSingle();

  if (slugErr) throw slugErr;
  if (!bySlug?.id) return null;

  return {
    id: String(bySlug.id),
    name: String(bySlug.name ?? label),
    slug: String(bySlug.slug),
    subdomain: bySlug.subdomain == null ? null : String(bySlug.subdomain),
  };
}

function normalizeTenantLookupKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * Resolves tenant for email tests: tries subdomain, slug, then display name.
 * Pass candidates like "subdomain test", "subdomaintest", "test".
 */
export async function resolveTenantBySubdomainOrName(
  supabase: SupabaseClient,
  candidates: string[]
): Promise<TenantBySubdomain | null> {
  const seen = new Set<string>();

  for (const raw of candidates) {
    const label = raw.trim().toLowerCase();
    if (!label || seen.has(label)) continue;
    seen.add(label);

    const { data: byName, error: nameErr } = await supabase
      .from("tenants")
      .select("id, name, slug, subdomain")
      .ilike("name", label)
      .eq("is_active", true)
      .maybeSingle();

    if (nameErr) throw nameErr;
    if (byName?.id) {
      return {
        id: String(byName.id),
        name: String(byName.name),
        slug: String(byName.slug),
        subdomain: byName.subdomain == null ? null : String(byName.subdomain),
      };
    }
  }

  for (const raw of candidates) {
    const keys = [
      normalizeTenantLookupKey(raw),
      raw.trim().toLowerCase().replace(/\s+/g, "-"),
      raw.trim().toLowerCase(),
    ];
    for (const key of keys) {
      if (!key || seen.has(`sub:${key}`)) continue;
      seen.add(`sub:${key}`);
      const hit = await resolveTenantBySubdomain(supabase, key);
      if (hit) return hit;
    }
  }

  return null;
}
