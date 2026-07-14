import { resolveApplicantEmailOrigin } from "@/lib/email/applicant-public-origin";
import { workerSignInHref } from "@/lib/auth/worker-sign-in";

export type ApplicantTemplateUrlVariables = {
  applicantPortalUrl?: string;
  applicationStatusUrl?: string;
  applicantContinuationLink?: string;
};

/**
 * Applicant / worker sign-in link for email templates.
 * Example: https://jobs.brasshr.com/worker-signin?tenant=jobs
 */
export function buildApplicantPortalUrl(origin: string, tenantSlug: string): string {
  const slug = tenantSlug.trim().toLowerCase();
  const base = resolveApplicantEmailOrigin(origin, slug);
  return `${base}${workerSignInHref({ tenant: slug })}`;
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
  out = out.replace(
    /https?:\/\/[^\s"'<>]+\/worker-signin\?tenant=[^"'<>\s&]+/gi,
    "{{applicantPortalUrl}}"
  );
  // Legacy home-page applicant portal links from older templates.
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
      /https?:\/\/[^\s"'<>]+\/worker-signin\?tenant=[^"'<>\s&]+/gi,
      variables.applicantPortalUrl
    );
    // Rewrite legacy home links baked into older approved templates.
    out = out.replace(
      /https?:\/\/[^\s"'<>]+\/\?tenant=[^"'<>\s&]+/gi,
      variables.applicantPortalUrl
    );
  }

  return out;
}
