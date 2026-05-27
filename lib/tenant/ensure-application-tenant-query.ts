import { NextResponse, type NextRequest } from "next/server";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/** Persists `?tenant=` to cookie; redirects to add tenant when cookie exists but query is missing. */
export function ensureApplicationTenantQuery(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const pathname = request.nextUrl.pathname;
  const needsTenant =
    pathname.startsWith("/application") || pathname === "/worker-onboarding";
  if (!needsTenant) return response;

  const tenantParam = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();
  if (tenantParam && tenantParam.length >= 2) {
    response.cookies.set(ONBOARDING_TENANT_SLUG_COOKIE, tenantParam, COOKIE_OPTS);
    return response;
  }

  const cookieSlug = request.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
  if (!cookieSlug || cookieSlug.length < 2) return response;

  const url = request.nextUrl.clone();
  url.searchParams.set("tenant", cookieSlug);

  if (request.nextUrl.pathname === url.pathname && request.nextUrl.search === url.search) {
    response.cookies.set(ONBOARDING_TENANT_SLUG_COOKIE, cookieSlug, COOKIE_OPTS);
    return response;
  }

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie.name, cookie.value, cookie);
  });
  return redirect;
}
