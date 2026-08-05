import "server-only";

import { buildCacheKey, cachePrefix, deleteCache, deleteByPattern } from "@/lib/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type TenantBrandingCacheIdentity = {
  tenantId: string;
  slug?: string | null;
  subdomain?: string | null;
};

function normalizeLabel(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

async function resolveTenantBrandingCacheIdentity(
  identity: string | TenantBrandingCacheIdentity
): Promise<{ tenantId: string; slug?: string; subdomain?: string }> {
  const tenantId = typeof identity === "string" ? identity : identity.tenantId;
  let slug = typeof identity === "string" ? undefined : normalizeLabel(identity.slug);
  let subdomain = typeof identity === "string" ? undefined : normalizeLabel(identity.subdomain);

  if (!slug || !subdomain) {
    const sb = createServiceRoleClient();
    if (sb) {
      const { data } = await sb
        .from("tenants")
        .select("slug, subdomain")
        .eq("id", tenantId)
        .maybeSingle<{ slug: string | null; subdomain: string | null }>();
      slug = slug || normalizeLabel(data?.slug);
      subdomain = subdomain || normalizeLabel(data?.subdomain);
    }
  }

  return { tenantId, slug, subdomain };
}

/**
 * Clears tenant branding for admin chrome, public login/applicant APIs, and tenant row cache.
 *
 * Keys use `supabase:{projectRef}:…` — patterns must include {@link cachePrefix}.
 */
export async function invalidateTenantBrandingCache(
  identity: string | TenantBrandingCacheIdentity
): Promise<void> {
  const { tenantId, slug, subdomain } = await resolveTenantBrandingCacheIdentity(identity);
  const prefix = cachePrefix();

  // Actual effective-branding key shape:
  //   {prefix}:admin_effective_branding:user:{userId}:tenant:{tenantId}:{hash}
  const patterns = [
    `${prefix}:admin_effective_branding:*:tenant:${tenantId}:*`,
    `${prefix}:tenant_branding:tenantId:${tenantId}:*`,
  ];

  if (slug) {
    patterns.push(`${prefix}:tenant_branding:slug:${slug}:*`);
  }
  if (subdomain) {
    patterns.push(`${prefix}:tenant_branding:subdomain:${subdomain}:*`);
  }

  await Promise.all([
    deleteCache(
      buildCacheKey("tenants", ["tenant", tenantId, "branding"], {
        fields: "branding",
      })
    ),
    deleteCache(
      buildCacheKey("tenants", ["tenant", tenantId, "branding"], {
        fields: "branding+typography",
      })
    ),
    ...patterns.map((pattern) => deleteByPattern(pattern)),
  ]);
}
