import { resolveApplicantEmailOrigin } from "@/lib/email/applicant-public-origin";

/**
 * Absolute URL for the applicant status page, scoped to the tenant vanity host.
 */
export function buildApplicationStatusUrl(params: {
  origin: string;
  tenantSlug: string;
}): string {
  const slug = params.tenantSlug.trim().toLowerCase();
  const base = resolveApplicantEmailOrigin(params.origin, slug);
  const path = "/application/application-status";
  const qs = slug.length >= 2 ? `?tenant=${encodeURIComponent(slug)}` : "";
  return `${base}${path}${qs}`;
}
