import type { TenantBranding } from "@/lib/tenant/tenant-branding";

export const BRANDING_UPDATED_EVENT = "brasshr:branding-updated";

export type BrandingUpdatedDetail = {
  branding?: TenantBranding;
};

export function notifyBrandingUpdated(branding?: TenantBranding): void {
  if (typeof window === "undefined") return;
  const detail: BrandingUpdatedDetail = branding ? { branding } : {};
  window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail }));
}
