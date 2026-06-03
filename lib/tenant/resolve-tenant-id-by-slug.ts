import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";

/** Resolve active tenant UUID from slug or subdomain label. */
export async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slugOrSubdomain: string
): Promise<string | null> {
  const key = slugOrSubdomain.trim().toLowerCase();
  if (key.length < 2) return null;
  return getOrSetCache(
    buildCacheKey("tenants", ["public", "slug", key], { active: true }),
    () => resolveTenantIdBySlugUncached(supabase, key),
    CACHE_TTL_SECONDS.staticReference
  );
}

async function resolveTenantIdBySlugUncached(
  supabase: SupabaseClient,
  key: string
): Promise<string | null> {
  const { data: bySlug, error: slugErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", key)
    .eq("is_active", true)
    .maybeSingle();

  if (slugErr) throw slugErr;
  if (bySlug?.id) return String(bySlug.id);

  const { data: bySub, error: subErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", key)
    .eq("is_active", true)
    .maybeSingle();

  if (subErr) throw subErr;
  return bySub?.id ? String(bySub.id) : null;
}
