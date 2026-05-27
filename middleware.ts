import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import {
  getUserPlatform,
  isNexusPlatformUser,
  isPlatformEnforcementEnabled,
  logAuthDebug,
} from "@/lib/auth/platform-shared";
import { ONBOARDING_TENANT_SLUG_COOKIE } from "@/lib/tenant/constants";
import { lookupTenantSlugBySubdomain } from "@/lib/tenant/lookup-tenant-subdomain";
import {
  extractTenantSubdomainLabel,
  forwardedHostFromHeaders,
  getRootDomainFromEnv,
} from "@/lib/tenant/tenant-host-resolution";
import { ensureApplicationTenantQuery } from "@/lib/tenant/ensure-application-tenant-query";
import {
  fetchOwnerOnboardingStatus,
  resolvePostAuthRedirect,
  shouldBlockAdminDashboardAccess,
  shouldBlockTenantOnboardingAccess,
} from "@/lib/auth/owner-onboarding-status";

function isPublicUiPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return true;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/auth/v1/")) return true;
  if (pathname.startsWith("/icons/") || pathname.startsWith("/images/")) return true;
  return false;
}

/**
 * Refreshes Supabase Auth cookies; enforces login + `app_metadata.platform === nexus` for protected UI/APIs.
 */
export async function middleware(request: NextRequest) {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** `{sub}.{ROOT_DOMAIN}` → onboarding cookie + fallback rewrite for applicant surfaces */
  const rootDomain = getRootDomainFromEnv();
  const hostNorm = forwardedHostFromHeaders(request.headers);
  const tenantLabel =
    rootDomain && hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;
  const subdomainRoutingPaths =
    pathname === "/" ||
    pathname.startsWith("/application") ||
    pathname === "/login" ||
    pathname.startsWith("/login/");

  if (
    tenantLabel &&
    subdomainRoutingPaths &&
    pathname !== "/tenant-host-not-found"
  ) {
    const slugResolved = await lookupTenantSlugBySubdomain(supabase, tenantLabel);
    if (slugResolved) {
      response.cookies.set(ONBOARDING_TENANT_SLUG_COOKIE, slugResolved, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    } else {
      const u = request.nextUrl.clone();
      u.pathname = "/tenant-host-not-found";
      u.searchParams.set("subdomain", tenantLabel);
      const rew = NextResponse.rewrite(u);
      response.cookies.getAll().forEach((cookie) => {
        rew.cookies.set(cookie.name, cookie.value);
      });
      return rew;
    }
  }

  const forceOn =
    process.env.ADMIN_RBAC_ENFORCE === "true" ||
    process.env.NEXT_PUBLIC_ADMIN_AUTH_REQUIRED === "true";
  const forceOff =
    process.env.ADMIN_RBAC_ENFORCE === "false" ||
    process.env.NEXT_PUBLIC_ADMIN_AUTH_REQUIRED === "false";
  const enforceUi = process.env.NODE_ENV === "production" ? !forceOff : forceOn;

  const platformOn = isPlatformEnforcementEnabled();
  const isApi = pathname.startsWith("/api/");
  /** In development, rely on route handlers (incl. dev bypass); in production, gate APIs here so session always matches UI. */
  const gateApiInMiddleware = process.env.NODE_ENV === "production";

  logAuthDebug("middleware", {
    userId: user?.id ?? null,
    platform: user ? getUserPlatform(user) : null,
  });

  if (isApi && gateApiInMiddleware) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (platformOn && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      await supabase.auth.signOut();
      logAuthDebug("middleware:api:block-platform", {
        userId: user.id,
        platform: getUserPlatform(user),
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    return response;
  }

  const isSignupPath = pathname === "/signup";
  const isTenantOnboardingPath =
    pathname === "/tenant-onboarding" || pathname.startsWith("/tenant-onboarding/");
  const isAdminRecruiterPath = pathname.startsWith("/admin_recruiter");
  const ownerFlowPath = isSignupPath || isTenantOnboardingPath || isAdminRecruiterPath;

  if (ownerFlowPath && user) {
    const onboardingStatus = await fetchOwnerOnboardingStatus(supabase, user);

    if (isSignupPath) {
      const destination = resolvePostAuthRedirect(
        onboardingStatus,
        request.nextUrl.searchParams.get("next")
      );
      if (destination !== "/signup") {
        return NextResponse.redirect(new URL(destination, request.url));
      }
    }

    if (isTenantOnboardingPath && shouldBlockTenantOnboardingAccess(onboardingStatus)) {
      const destination = resolvePostAuthRedirect(
        onboardingStatus,
        request.nextUrl.searchParams.get("next")
      );
      return NextResponse.redirect(new URL(destination, request.url));
    }

    if (isAdminRecruiterPath && shouldBlockAdminDashboardAccess(onboardingStatus)) {
      const destination = resolvePostAuthRedirect(
        onboardingStatus,
        request.nextUrl.searchParams.get("next")
      );
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  if (isTenantOnboardingPath && !user) {
    const signup = new URL("/signup", request.url);
    signup.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signup);
  }

  if (isPublicUiPath(pathname)) {
    return response;
  }

  if ((enforceUi || isAdminRecruiterPath) && isAdminRecruiterPath) {
    if (!user) {
      const login = new URL("/signin", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (platformOn && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      await supabase.auth.signOut();
      const login = new URL("/signin", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      login.searchParams.set("error", "platform");
      return NextResponse.redirect(login);
    }
  }

  /**
   * Applicant onboarding is public (anonymous sign-in happens client-side).
   * Do not apply recruiter platform/auth gates here — that sent applicants to /login.
   */
  if (pathname.startsWith("/application")) {
    return ensureApplicationTenantQuery(request, response);
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/login/:path*",
    "/signin",
    "/signin/:path*",
    "/signup",
    "/tenant-onboarding",
    "/tenant-onboarding/:path*",
    "/tenant-host-not-found",
    "/admin_recruiter/:path*",
    "/application",
    "/application/:path*",
    "/api/workers",
    "/api/workers/:path*",
    "/api/search-workers",
    "/api/search-workers/:path*",
    "/api/admin/:path*",
  ],
};
