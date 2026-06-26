import "server-only";

import { buildCacheKey, deleteCache } from "@/lib/cache";

export async function invalidateTenantBrandingCache(tenantId: string): Promise<void> {
  await deleteCache(
    buildCacheKey("tenants", ["tenant", tenantId, "branding"], {
      fields: "branding",
    })
  );
}
