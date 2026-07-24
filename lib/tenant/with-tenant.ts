import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";

const APPLICATION_JOB_TOKEN_KEY = "applicationJobToken";

/** Read job token from the current browser URL or localStorage (apply flow). */
export function currentApplicationJobToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = normalizeJobToken(new URLSearchParams(window.location.search).get("job_token"));
    if (fromUrl) return fromUrl;
    return normalizeJobToken(localStorage.getItem(APPLICATION_JOB_TOKEN_KEY));
  } catch {
    return null;
  }
}

/** Appends `?tenant=` (and preserves `job_token` when known) for applicant navigation. */
export function withTenant(path: string, tenant?: string | null): string {
  const slug = tenant?.trim().toLowerCase();
  if (!slug || slug.length < 2) return path;

  const [pathname, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("tenant", slug);

  const jobToken = currentApplicationJobToken();
  if (jobToken && !params.get("job_token")) {
    params.set("job_token", jobToken);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
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
