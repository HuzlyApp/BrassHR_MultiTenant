function portalSignInHref(
  path: string,
  options?: { tenant?: string | null; next?: string | null }
): string {
  const params = new URLSearchParams();
  const tenant = options?.tenant?.trim().toLowerCase();
  if (tenant && tenant.length >= 2) {
    params.set("tenant", tenant);
  }
  const next = options?.next?.trim();
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    params.set("next", next);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Hired worker portal sign-in. */
export function workerSignInHref(options?: { tenant?: string | null }): string {
  return portalSignInHref("/worker-signin", options);
}

/** Candidate portal sign-in. */
export function candidateSignInHref(options?: { tenant?: string | null; next?: string | null }): string {
  return portalSignInHref("/candidate-signin", options);
}
