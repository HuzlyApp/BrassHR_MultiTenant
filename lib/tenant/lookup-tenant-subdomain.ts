import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache-edge";

export async function lookupTenantSlugBySubdomain(
  client: SupabaseClient,
  subdomainLabel: string
): Promise<string | null> {
  const label = subdomainLabel.trim().toLowerCase();
  if (!label) return null;

  return getOrSetCache(
    buildCacheKey("tenants", ["subdomain", label], { lookup: "slug" }),
    async () => {
      const { data, error } = await client.rpc("public_tenant_branding", { p_kind: "subdomain", p_value: label });
      return !error && typeof data?.slug === "string" ? data.slug : null;
    },
    CACHE_TTL_SECONDS.staticReference,
  );
}
