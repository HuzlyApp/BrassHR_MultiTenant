import { NextResponse, type NextRequest } from "next/server";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import {
  forwardedHostFromHeaders,
  getEffectiveRootDomain,
  isRootDomainHost,
} from "@/lib/tenant/tenant-host-resolution";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, cookie);
  });
}

function clearTenantSlugCookie(response: NextResponse) {
  response.cookies.delete(ONBOARDING_TENANT_SLUG_COOKIE);
}

/**
 * Persists `?tenant=` to cookie on apex; on vanity hosts hostname cookie wins over mismatched query.
 * Never propagates a stale cookie onto the root marketing site.
 */
export function ensureApplicationTenantQuery(
  request: NextRequest,
  response: NextResponse,
  hostSubdomainLabel?: string | null
): NextResponse {
  const pathname = request.nextUrl.pathname;
  const needsTenant =
    pathname.startsWith("/application") || pathname === "/worker-onboarding";
  if (!needsTenant) return response;

  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(request.headers);
  const onRootDomain = Boolean(hostNorm && isRootDomainHost(hostNorm, rootDomain));

  if (hostSubdomainLabel) {
    const cookieSlug = request.cookies
      .get(ONBOARDING_TENANT_SLUG_COOKIE)
      ?.value?.trim()
      .toLowerCase();
    const tenantParam = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();

    if (tenantParam && cookieSlug && tenantParam !== cookieSlug) {
      const url = request.nextUrl.clone();
      url.searchParams.set("tenant", cookieSlug);
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }

    if (!tenantParam && cookieSlug) {
      const url = request.nextUrl.clone();
      url.searchParams.set("tenant", cookieSlug);
      const redirect = NextResponse.redirect(url);
      copyCookies(response, redirect);
      return redirect;
    }

    return response;
  }

  const tenantParam = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();
  if (tenantParam && tenantParam.length >= 2) {
    response.cookies.set(ONBOARDING_TENANT_SLUG_COOKIE, tenantParam, COOKIE_OPTS);
    return response;
  }

  if (onRootDomain) {
    clearTenantSlugCookie(response);
    return response;
  }

  const cookieSlug = request.cookies
    .get(ONBOARDING_TENANT_SLUG_COOKIE)
    ?.value?.trim()
    .toLowerCase();
  if (!cookieSlug || cookieSlug.length < 2) return response;

  const url = request.nextUrl.clone();
  url.searchParams.set("tenant", cookieSlug);

  if (request.nextUrl.pathname === url.pathname && request.nextUrl.search === url.search) {
    response.cookies.set(ONBOARDING_TENANT_SLUG_COOKIE, cookieSlug, COOKIE_OPTS);
    return response;
  }

  const redirect = NextResponse.redirect(url);
  copyCookies(response, redirect);
  return redirect;
}

/** Clears tenant slug cookie on root marketing/login surfaces. */
export function clearTenantSlugCookieOnRootHost(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(request.headers);
  if (!hostNorm || !isRootDomainHost(hostNorm, rootDomain)) {
    return response;
  }

  const tenantParam = request.nextUrl.searchParams.get("tenant")?.trim();
  if (tenantParam && tenantParam.length >= 2) {
    return response;
  }

  clearTenantSlugCookie(response);
  return response;
}
