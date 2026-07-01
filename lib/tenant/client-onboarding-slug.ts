import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import {
  isApplicantTenantPath,
  readOnboardingSlugCookie,
  resolveClientTenantHost,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";

/** Reads `tenant` query (?tenant=…) or onboarding cookie slug (browser only). */
export function resolveClientOnboardingTenantSlug(search: string): string | null {
  const path = typeof window !== "undefined" ? window.location.pathname : undefined;
  return resolveTenantSlugForClient(search, {
    allowCookieOnRoot: isApplicantTenantPath(path),
    path,
  }).slug;
}

export function persistOnboardingSlugCookie(slug: string): void {
  if (typeof document === "undefined") return;
  const { subdomainLabel, isRootDomain } = resolveClientTenantHost();
  const s = slug.trim().toLowerCase();
  if (s.length < 2) return;

  if (subdomainLabel) {
    const cookieSlug = readOnboardingSlugCookie();
    if (cookieSlug && cookieSlug !== s) {
      return;
    }
  }

  if (isRootDomain && !isApplicantTenantPath()) {
    return;
  }

  document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=${encodeURIComponent(s)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
