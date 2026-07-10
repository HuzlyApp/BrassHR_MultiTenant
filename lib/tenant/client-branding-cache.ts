import {
  readHostnameScopedItem,
  writeHostnameScopedItem,
} from "@/lib/tenant/scoped-storage";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

const CACHE_KEY = "tenantBrandingV1";

function isCachedBranding(value: unknown): value is TenantBranding {
  if (!value || typeof value !== "object") return false;
  const row = value as TenantBranding;
  return (
    typeof row.primaryHex === "string" &&
    typeof row.secondaryHex === "string" &&
    typeof row.companyName === "string"
  );
}

/** Hostname-scoped branding snapshot for instant auth-shell paint on refresh. */
export function readCachedTenantBranding(): TenantBranding | null {
  const raw = readHostnameScopedItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCachedBranding(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedTenantBranding(branding: TenantBranding): void {
  writeHostnameScopedItem(CACHE_KEY, JSON.stringify(branding));
}
