import "server-only";

import { buildCacheKey, deleteCache, deleteByPattern } from "@/lib/cache";

/** Clears tenant row branding plus all cached admin chrome payloads for that tenant. */
export async function invalidateTenantBrandingCache(tenantId: string): Promise<void> {
  await Promise.all([
    deleteCache(
      buildCacheKey("tenants", ["tenant", tenantId, "branding"], {
        fields: "branding",
      })
    ),
    deleteByPattern(`supabase:admin_effective_branding:*:tenant:${tenantId}:*`),
  ]);
}
