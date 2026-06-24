import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";

/** Client-side hint only (UUID from env); prefer passing `tenantSlug` to APIs. */
export function getClientOnboardingTenantIdFallback(): string | null {
  return getConfiguredDefaultTenantId();
}
