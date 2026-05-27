/**
 * Recruiter/admin sign-in entry (tenant landing, middleware guards).
 * Applicants use worker onboarding / signup — not these URLs.
 */
export function recruiterSignInHref(options?: {
  tenant?: string | null;
  next?: string | null;
}): string {
  const params = new URLSearchParams();
  const tenant = options?.tenant?.trim().toLowerCase();
  if (tenant && tenant.length >= 2) {
    params.set("tenant", tenant);
  }
  params.set("role", "admin_recruiter");
  const next = options?.next?.trim();
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    params.set("next", next);
  }
  const qs = params.toString();
  return qs ? `/signin?${qs}` : "/signin";
}

export function isRecruiterSignInRole(
  role: string | null | undefined
): boolean {
  const key = role?.trim().toLowerCase();
  return key === "admin_recruiter" || key === "recruiter";
}
