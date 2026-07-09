import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";
import { getClientTenantHostLabel } from "@/lib/tenant/client-host-subdomain";

/** Tenant slug for applicant-portal API calls in the browser. */
export function resolveApplicantPortalTenantSlug(): string | null {
  if (typeof window === "undefined") return null;

  const fromHost = getClientTenantHostLabel();
  if (fromHost) return fromHost;

  return resolveClientOnboardingTenantSlug(window.location.search);
}

export function applicantPortalApiPath(path: string, tenantSlug?: string | null): string {
  const base = path.startsWith("/") ? path : `/${path}`;
  const slug = tenantSlug?.trim().toLowerCase() ?? resolveApplicantPortalTenantSlug();
  if (!slug) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}tenantSlug=${encodeURIComponent(slug)}`;
}
