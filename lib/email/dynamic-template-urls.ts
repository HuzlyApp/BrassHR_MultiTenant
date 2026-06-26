import { normalizePublicOrigin } from "@/lib/resolve-app-origin";

export type ApplicantTemplateUrlVariables = {
  applicantPortalUrl?: string;
  applicationStatusUrl?: string;
  applicantContinuationLink?: string;
};

/** Applicant sign-in link for a tenant on the current app host. */
export function buildApplicantPortalUrl(origin: string, tenantSlug: string): string {
  const base = normalizePublicOrigin(origin);
  const slug = tenantSlug.trim();
  return `${base}/?tenant=${encodeURIComponent(slug)}`;
}

/**
 * Templates edited in admin sometimes keep a baked-in host (e.g. localhost).
 * Swap those back to placeholders before interpolation.
 */
export function restoreDynamicUrlPlaceholders(content: string): string {
  let out = content;
  out = out.replace(
    /https?:\/\/[^\s"'<>]+\/application\/continue[^\s"'<>]*/gi,
    "{{applicantContinuationLink}}"
  );
  out = out.replace(
    /https?:\/\/[^\s"'<>]+\/application\/application-status\?tenant=[^"'<>\s&]+/gi,
    "{{applicationStatusUrl}}"
  );
  out = out.replace(/https?:\/\/[^\s"'<>]+\/\?tenant=[^"'<>\s&]+/gi, "{{applicantPortalUrl}}");
  return out;
}

/**
 * After interpolation, replace any remaining absolute app URLs with the
 * values built for the current environment (browser origin or server host).
 */
export function rewriteEmbeddedAppUrls(
  content: string,
  variables: ApplicantTemplateUrlVariables
): string {
  let out = content;

  if (variables.applicantContinuationLink) {
    out = out.replace(
      /https?:\/\/[^\s"'<>]+\/application\/continue[^\s"'<>]*/gi,
      variables.applicantContinuationLink
    );
  }

  if (variables.applicationStatusUrl) {
    out = out.replace(
      /https?:\/\/[^\s"'<>]+\/application\/application-status\?tenant=[^"'<>\s&]+/gi,
      variables.applicationStatusUrl
    );
  }

  if (variables.applicantPortalUrl) {
    out = out.replace(
      /https?:\/\/[^\s"'<>]+\/\?tenant=[^"'<>\s&]+/gi,
      variables.applicantPortalUrl
    );
  }

  return out;
}
