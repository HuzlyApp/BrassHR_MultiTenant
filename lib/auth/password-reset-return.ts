/** Allowed post-reset destinations (path only). */
const ALLOWED_RETURN_PATHS = new Set(["/admin", "/worker-signin"]);

/**
 * Normalize the forget/reset `return` path. Defaults to admin company login.
 */
export function safePasswordResetReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  const pathOnly = value.split("?")[0]?.trim() || "/admin";
  if (pathOnly === "/login" || pathOnly.startsWith("/login/")) return "/admin";
  if (ALLOWED_RETURN_PATHS.has(pathOnly)) return pathOnly;
  return "/admin";
}

export function withTenantQuery(href: string, tenant: string | null | undefined): string {
  const slug = tenant?.trim().toLowerCase();
  if (!slug || slug.length < 2) return href;
  const [path, existingQs = ""] = href.split("?");
  const params = new URLSearchParams(existingQs);
  if (!params.has("tenant")) params.set("tenant", slug);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** `/forgot?return=…&tenant=…` for admin or worker entry points. */
export function buildForgotPasswordHref(options: {
  returnTo?: string | null;
  tenant?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("return", safePasswordResetReturnPath(options.returnTo));
  const slug = options.tenant?.trim().toLowerCase();
  if (slug && slug.length >= 2) params.set("tenant", slug);
  return `/forgot?${params.toString()}`;
}

/** Where to send the user after a successful password update. */
export function buildPostResetSignInHref(
  returnTo: string | null | undefined,
  tenant: string | null | undefined
): string {
  return withTenantQuery(safePasswordResetReturnPath(returnTo), tenant);
}
