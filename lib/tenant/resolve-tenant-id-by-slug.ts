import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCacheKey, CACHE_TTL_SECONDS, deleteCache, getCache, setCache } from "@/lib/cache";

function isTenantUuid(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8;
}

/** Resolve active tenant UUID from slug or subdomain label. */
export async function resolveTenantIdBySlug(
  supabase: SupabaseClient,
  slugOrSubdomain: string
): Promise<string | null> {
  const key = slugOrSubdomain.trim().toLowerCase();
  if (key.length < 2) return null;
  const cacheKey = buildCacheKey("tenants", ["public", "slug", key], { active: true });
  const cached = await getCache<unknown>(cacheKey);
  if (isTenantUuid(cached)) {
    return cached.trim();
  }
  if (cached != null) {
    await deleteCache(cacheKey);
  }
  const id = await resolveTenantIdBySlugUncached(supabase, key);
  if (id) {
    await setCache(cacheKey, id, CACHE_TTL_SECONDS.staticReference);
  }
  return id;
}

export async function resolveTenantIdBySlugUncached(
  supabase: SupabaseClient,
  key: string
): Promise<string | null> {
  const normalized = key.trim().toLowerCase();
  if (normalized.length < 2) return null;

  const { data: bySlug, error: slugErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (slugErr) throw slugErr;
  if (bySlug?.id) return String(bySlug.id);

  const { data: bySub, error: subErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", normalized)
    .eq("is_active", true)
    .maybeSingle();

  if (subErr) throw subErr;
  return bySub?.id ? String(bySub.id) : null;
}
