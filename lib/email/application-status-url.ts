import { normalizePublicOrigin } from "@/lib/resolve-app-origin";

/**
 * Absolute URL for the applicant status page, scoped to the tenant slug.
 */
export function buildApplicationStatusUrl(params: {
  origin: string;
  tenantSlug: string;
}): string {
  const base = normalizePublicOrigin(params.origin);
  const slug = params.tenantSlug.trim().toLowerCase();
  const path = "/application/application-status";
  const qs = slug.length >= 2 ? `?tenant=${encodeURIComponent(slug)}` : "";
  return `${base}${path}${qs}`;
}
