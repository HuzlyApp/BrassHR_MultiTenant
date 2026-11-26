import { loadPublicTenantBranding } from "@/lib/tenant/load-public-tenant-branding";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

export async function loadTenantBrandingBySlug(slug: string): Promise<TenantBranding> {
  return loadPublicTenantBranding({ slug: slug.trim().toLowerCase() });
}
