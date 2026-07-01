import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import {
  forwardedHostFromHeaders,
  getEffectiveRootDomain,
  isRootDomainHost,
  normalizeHostHeader,
  extractTenantSubdomainLabel,
} from "@/lib/tenant/tenant-host-resolution";

export type TenantResolutionSource = "hostname" | "query" | "cookie" | "none";

export type ResolvedTenantSlug = {
  slug: string | null;
  subdomainLabel: string | null;
  hostname: string | null;
  isRootDomain: boolean;
  source: TenantResolutionSource;
};

export function resolveTenantHostFromHostname(
  hostname: string | null | undefined,
  rootDomain?: string
): {
  hostname: string | null;
  isRootDomain: boolean;
  subdomainLabel: string | null;
} {
  const host = normalizeHostHeader(hostname ?? null);
  const root = (rootDomain ?? getEffectiveRootDomain()).toLowerCase();
  if (!host) {
    return { hostname: null, isRootDomain: false, subdomainLabel: null };
  }
  const isRoot = isRootDomainHost(host, root);
  const subdomainLabel = isRoot ? null : extractTenantSubdomainLabel(host, root);
  return { hostname: host, isRootDomain: isRoot, subdomainLabel };
}

export function resolveRequestTenantHost(headers: Headers) {
  const host = forwardedHostFromHeaders(headers);
  return resolveTenantHostFromHostname(host);
}

export function resolveClientTenantHost() {
  if (typeof window === "undefined") {
    return { hostname: null, isRootDomain: false, subdomainLabel: null };
  }
  return resolveTenantHostFromHostname(window.location.hostname);
}

function readTenantFromQuery(search: string): string | null {
  try {
    const fromQuery = new URLSearchParams(search).get("tenant")?.trim().toLowerCase();
    return fromQuery && fromQuery.length >= 2 ? fromQuery : null;
  } catch {
    return null;
  }
}

export function readOnboardingSlugCookie(): string | null {
  if (typeof document === "undefined") return null;
  const needle = `${ONBOARDING_TENANT_SLUG_COOKIE}=`;
  const chunk = document.cookie.split("; ").find((c) => c.startsWith(needle));
  if (!chunk) return null;
  try {
    const raw = decodeURIComponent(chunk.slice(needle.length)).trim().toLowerCase();
    return raw.length >= 2 ? raw : null;
  } catch {
    return null;
  }
}

export function isApplicantTenantPath(path?: string): boolean {
  const pathname =
    path ??
    (typeof window !== "undefined" ? window.location.pathname : "");
  return pathname.startsWith("/application") || pathname === "/worker-onboarding";
}

/**
 * Resolves tenant slug with hostname authority.
 * Vanity subdomains always win over query/cookie; root domain never falls back to cookie on marketing surfaces.
 */
export function resolveTenantSlugForClient(
  search: string,
  options?: { allowCookieOnRoot?: boolean; path?: string }
): ResolvedTenantSlug {
  const { hostname, isRootDomain, subdomainLabel } = resolveClientTenantHost();
  const fromQuery = readTenantFromQuery(search);
  const fromCookie = readOnboardingSlugCookie();
  const allowCookieOnRoot =
    options?.allowCookieOnRoot ?? isApplicantTenantPath(options?.path);

  if (subdomainLabel) {
    const slug = fromCookie ?? subdomainLabel;
    return {
      slug,
      subdomainLabel,
      hostname,
      isRootDomain: false,
      source: fromCookie ? "cookie" : "hostname",
    };
  }

  if (isRootDomain) {
    if (fromQuery) {
      return {
        slug: fromQuery,
        subdomainLabel: null,
        hostname,
        isRootDomain: true,
        source: "query",
      };
    }
    if (allowCookieOnRoot && fromCookie) {
      return {
        slug: fromCookie,
        subdomainLabel: null,
        hostname,
        isRootDomain: true,
        source: "cookie",
      };
    }
    return {
      slug: null,
      subdomainLabel: null,
      hostname,
      isRootDomain: true,
      source: "none",
    };
  }

  const slug = fromQuery ?? (allowCookieOnRoot ? fromCookie : null);
  return {
    slug,
    subdomainLabel: null,
    hostname,
    isRootDomain: false,
    source: fromQuery ? "query" : fromCookie ? "cookie" : "none",
  };
}

export function buildTenantBrandingApiUrl(
  resolved: Pick<ResolvedTenantSlug, "slug" | "subdomainLabel" | "isRootDomain">
): string {
  if (resolved.subdomainLabel) {
    return `/api/tenant-branding?subdomain=${encodeURIComponent(resolved.subdomainLabel)}`;
  }
  if (resolved.isRootDomain && !resolved.slug) {
    return "/api/tenant-branding";
  }
  if (resolved.slug) {
    return `/api/tenant-branding?slug=${encodeURIComponent(resolved.slug)}`;
  }
  return "/api/tenant-branding";
}

export function clearOnboardingTenantSlugCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
