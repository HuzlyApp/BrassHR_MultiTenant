/**
 * Resolve tenant subdomain label from request Host vs ROOT_DOMAIN.
 * Server-only helpers (middleware, route handlers).
 */

export function forwardedHostFromHeaders(headers: Headers): string | null {
  const xf = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (xf) return normalizeHostHeader(xf);
  return normalizeHostHeader(headers.get("host"));
}

export function getRootDomainFromEnv(): string | null {
  const r = process.env.ROOT_DOMAIN?.trim().toLowerCase();
  return r && r.length > 0 ? r : null;
}

/** Server + client root domain (ROOT_DOMAIN with NEXT_PUBLIC_ROOT_DOMAIN fallback). */
export function getEffectiveRootDomain(): string {
  return (
    getRootDomainFromEnv() ??
    process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase() ??
    "brasshr.com"
  );
}

/** Strip brackets (IPv6) and port */
export function normalizeHostHeader(host: string | null | undefined): string | null {
  if (!host) return null;
  let h = host.trim().toLowerCase();
  const ipv6End = h.indexOf("]");
  if (h.startsWith("[") && ipv6End > 0) {
    h = h.slice(1, ipv6End);
    return h || null;
  }
  const portIdx = h.indexOf(":");
  if (portIdx !== -1) h = h.slice(0, portIdx);
  return h || null;
}

export function isRootDomainHost(
  normalizedHost: string | null,
  rootDomain: string
): boolean {
  if (!normalizedHost || !rootDomain) return false;
  const apex = rootDomain.toLowerCase();
  const host = normalizedHost.toLowerCase();
  return host === apex || host === `www.${apex}`;
}

/**
 * If host is `{label}.{rootDomain}`, returns lowercase label (single label only).
 * Returns null for apex, www apex, mismatched domains, localhost, nested subdomains (a.b.domain).
 */
export function extractTenantSubdomainLabel(
  normalizedHost: string | null,
  rootDomain: string
): string | null {
  if (!normalizedHost || !rootDomain) return null;
  const apex = rootDomain.toLowerCase();
  if (
    normalizedHost === "localhost" ||
    normalizedHost.startsWith("127.0.0.1") ||
    normalizedHost === "[::1]" ||
    normalizedHost === "::1"
  ) {
    return null;
  }
  if (normalizedHost === apex || normalizedHost === `www.${apex}`) {
    return null;
  }
  const suf = `.${apex}`;
  if (!normalizedHost.endsWith(suf)) return null;
  const label = normalizedHost.slice(0, -suf.length);
  if (!label || label.includes(".")) return null;
  return label;
}
