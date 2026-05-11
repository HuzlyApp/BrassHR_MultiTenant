import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

/** Reads `tenant` query (?tenant=…) or onboarding cookie slug (browser only). */
export function resolveClientOnboardingTenantSlug(search: string): string | null {
  try {
    const q = new URLSearchParams(search);
    const fromQuery = q.get("tenant")?.trim();
    if (fromQuery && fromQuery.length >= 2) return fromQuery.toLowerCase();
  } catch {
    /* noop */
  }
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

export function persistOnboardingSlugCookie(slug: string): void {
  if (typeof document === "undefined") return;
  const s = slug.trim().toLowerCase();
  if (s.length < 2) return;
  document.cookie = `${ONBOARDING_TENANT_SLUG_COOKIE}=${encodeURIComponent(s)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
