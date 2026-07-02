/**
 * Recruiter/admin sign-in entry (tenant landing, middleware guards).
 * Applicants use worker onboarding / signup — not these URLs.
 */
import {
  readOnboardingSlugCookie,
  resolveClientTenantHost,
} from "@/lib/tenant/resolve-tenant-context";
import { PLATFORM_DEFAULT_TENANT_SLUG } from "@/lib/tenant/tenant-branding";

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

/** Recruiter login page with tenant branding (`/login?tenant=…&role=admin_recruiter`). */
export function recruiterLoginHref(options?: {
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
  return qs ? `/login?${qs}` : "/login?role=admin_recruiter";
}

export function resolveRecruiterLoginTenantSlug(options?: {
  brandingSlug?: string | null;
  organizationSubdomain?: string | null;
}): string | null {
  for (const raw of [options?.organizationSubdomain, options?.brandingSlug]) {
    const key = raw?.trim().toLowerCase();
    if (key && key.length >= 2 && key !== PLATFORM_DEFAULT_TENANT_SLUG) {
      return key;
    }
  }

  if (typeof window === "undefined") return null;

  const { subdomainLabel } = resolveClientTenantHost();
  if (subdomainLabel && subdomainLabel.length >= 2) {
    return subdomainLabel;
  }

  const fromQuery = new URLSearchParams(window.location.search).get("tenant")?.trim().toLowerCase();
  if (fromQuery && fromQuery.length >= 2) {
    return fromQuery;
  }

  const fromCookie = readOnboardingSlugCookie();
  if (fromCookie && fromCookie.length >= 2 && fromCookie !== PLATFORM_DEFAULT_TENANT_SLUG) {
    return fromCookie;
  }

  return null;
}

/** Post-logout redirect — tenant-branded recruiter login, not platform Brass HR. */
export function recruiterLogoutLoginHref(options?: {
  brandingSlug?: string | null;
  organizationSubdomain?: string | null;
}): string {
  return recruiterLoginHref({ tenant: resolveRecruiterLoginTenantSlug(options) });
}

export function isRecruiterSignInRole(
  role: string | null | undefined
): boolean {
  const key = role?.trim().toLowerCase();
  return key === "admin_recruiter" || key === "recruiter";
}
