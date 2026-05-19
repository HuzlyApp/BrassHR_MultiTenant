import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

/** Parse `Request` Cookie header → onboarding tenant slug value (server). */
export function onboardingSlugFromRequestCookies(req: Request): string | null {
  const h = req.headers.get("cookie");
  return onboardingSlugFromCookieHeader(h);
}

export function onboardingSlugFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader?.trim()) return null;
  const needle = `${ONBOARDING_TENANT_SLUG_COOKIE}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trimStart();
    if (!trimmed.toLowerCase().startsWith(needle.toLowerCase())) continue;
    const rawValue = trimmed.slice(needle.length);
    try {
      const slug = decodeURIComponent(rawValue.trim()).trim().toLowerCase();
      return slug.length >= 2 ? slug : null;
    } catch {
      return null;
    }
  }
  return null;
}
