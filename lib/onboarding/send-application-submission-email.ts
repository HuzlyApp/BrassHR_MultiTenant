import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";

/** Best-effort application status email after onboarding submission. */
export async function sendApplicationSubmissionEmail(applicantId: string): Promise<void> {
  const tenantSlug =
    typeof window !== "undefined" ? resolveClientOnboardingTenantSlug(window.location.search) : null;

  await fetch("/api/onboarding/send-application-emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicantId,
      clientOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
      ...(tenantSlug ? { tenantSlug } : {}),
    }),
  });
}
