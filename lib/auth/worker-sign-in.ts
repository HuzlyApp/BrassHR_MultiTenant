/** Applicant / worker portal sign-in entry. */
export function workerSignInHref(options?: { tenant?: string | null }): string {
  const params = new URLSearchParams();
  const tenant = options?.tenant?.trim().toLowerCase();
  if (tenant && tenant.length >= 2) {
    params.set("tenant", tenant);
  }
  const qs = params.toString();
  return qs ? `/worker-signin?${qs}` : "/worker-signin";
}
