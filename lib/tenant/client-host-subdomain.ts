/**
 * Client-side: extract tenant DNS label from `{label}.{ROOT_DOMAIN}` (e.g. subdomaintest.brasshr.com).
 */
import { getEffectiveRootDomain } from "@/lib/tenant/tenant-host-resolution";
import { resolveTenantHostFromHostname } from "@/lib/tenant/resolve-tenant-context";

export { getEffectiveRootDomain };

export function getClientTenantHostLabel(): string | null {
  if (typeof window === "undefined") return null;
  return resolveTenantHostFromHostname(window.location.hostname, getEffectiveRootDomain())
    .subdomainLabel;
}

export function isClientRootDomain(): boolean {
  if (typeof window === "undefined") return false;
  return resolveTenantHostFromHostname(window.location.hostname, getEffectiveRootDomain())
    .isRootDomain;
}
