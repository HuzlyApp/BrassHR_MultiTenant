import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";

/** Appends `?tenant=` (or `&tenant=`) when a slug is known. */
export function withTenant(path: string, tenant?: string | null): string {
  const slug = tenant?.trim().toLowerCase();
  if (!slug || slug.length < 2) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}tenant=${encodeURIComponent(slug)}`;
}

/** Resolves tenant slug from the current browser URL or onboarding cookie. */
export function currentOnboardingTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return resolveClientOnboardingTenantSlug(window.location.search);
}

/** Tenant-aware path for worker `/application/*` navigation (client-side). */
export function applicationPath(path: string, tenant?: string | null): string {
  return withTenant(path, tenant ?? currentOnboardingTenantSlug());
}
