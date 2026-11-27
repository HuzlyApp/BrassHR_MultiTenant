import { applicationPath } from "@/lib/tenant/with-tenant";
import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes";

/** Applicant portal link to view an application’s status and pending actions. */
export function applicantApplicationStatusHref(
  applicationId: string,
  tenantSlug?: string | null
): string {
  const base = applicationPath(APPLICATION_ROUTES.applicationStatus, tenantSlug);
  const params = new URLSearchParams();
  params.set("applicationId", applicationId);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${params.toString()}`;
}