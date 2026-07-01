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
  getEffectiveRootDomain,
} from "@/lib/tenant/tenant-host-resolution";
import { ensureApplicationTenantQuery, clearTenantSlugCookieOnRootHost } from "@/lib/tenant/ensure-application-tenant-query";
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

function isAnonymousAuthUser(user: { is_anonymous?: boolean } | null | undefined): boolean {
  return user?.is_anonymous === true;
}

/** Public APIs used by marketing / applicant landing pages (no session required). */
function isPublicApiPath(pathname: string): boolean {
  if (pathname === "/api/tenant-branding") return true;
  if (pathname === "/api/tenant-favicon") return true;
  if (pathname === "/api/worker-onboarding/entry") return true;
  if (pathname === "/api/auth/login-otp/send") return true;
  if (pathname === "/api/auth/login-otp/verify") return true;
  if (pathname === "/api/auth/signup") return true;
  if (pathname === "/api/auth/signup/check-email") return true;
  if (pathname === "/api/auth/signup/options") return true;
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
  const isAnonymousUser = isAnonymousAuthUser(user);

  /** `{sub}.{ROOT_DOMAIN}` → onboarding cookie + fallback rewrite for applicant surfaces */
  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(request.headers);
  const tenantLabel = hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;
  const subdomainRoutingPaths =
    pathname === "/" ||
    pathname.startsWith("/application") ||
    pathname === "/worker-onboarding" ||
    pathname === "/worker-signin" ||
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

  if (!tenantLabel && hostNorm) {
    clearTenantSlugCookieOnRootHost(request, response);
  }

  if (pathname === "/") {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Host");
  }

  const platformOn = isPlatformEnforcementEnabled();
  const isApi = pathname.startsWith("/api/");
  /** In development, rely on route handlers (incl. dev bypass); in production, gate APIs here so session always matches UI. */
  const gateApiInMiddleware = process.env.NODE_ENV === "production";

  logAuthDebug("middleware", {
    userId: user?.id ?? null,
    platform: user ? getUserPlatform(user) : null,
  });

  if (isApi && gateApiInMiddleware && !isPublicApiPath(pathname)) {
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
  const isGodAdminPath = pathname.startsWith("/godadmin");
  const isGodAdminApiPath = pathname.startsWith("/api/godadmin");
  const ownerFlowPath = isSignupPath || isTenantOnboardingPath || isAdminRecruiterPath;

  async function requireGodAdminSession(): Promise<NextResponse | null> {
    if (!user || isAnonymousUser) {
      const signin = new URL("/signin", request.url);
      signin.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      signin.searchParams.set("role", "admin_recruiter");
      return NextResponse.redirect(signin);
    }
    const onboardingStatus = await fetchOwnerOnboardingStatus(supabase, user);
    if (!onboardingStatus.godAdmin) {
      if (isGodAdminApiPath) {
        return NextResponse.json({ error: "Forbidden", detail: "God Admin role required." }, { status: 403 });
      }
      const signin = new URL("/signin", request.url);
      signin.searchParams.set("error", "forbidden");
      return NextResponse.redirect(signin);
    }
    return null;
  }

  if (isGodAdminPath || isGodAdminApiPath) {
    const gate = await requireGodAdminSession();
    if (gate) return gate;
    if (isGodAdminApiPath) return response;
  }

  if (ownerFlowPath && user && !isAnonymousUser) {
    const onboardingStatus = await fetchOwnerOnboardingStatus(supabase, user);

    if (isSignupPath) {
      if (!onboardingStatus.signupCompleted) {
        return response;
      }
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

  if (isTenantOnboardingPath && (!user || isAnonymousUser)) {
    const signin = new URL("/signin", request.url);
    signin.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    signin.searchParams.set("role", "admin_recruiter");
    const tenant = request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase();
    if (tenant && tenant.length >= 2) {
      signin.searchParams.set("tenant", tenant);
    }
    return NextResponse.redirect(signin);
  }

  const isLoginPath =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/signin" ||
    pathname.startsWith("/signin/");

  if (isLoginPath && user && !isAnonymousUser) {
    const onboardingStatus = await fetchOwnerOnboardingStatus(supabase, user);
    const destination = resolvePostAuthRedirect(
      onboardingStatus,
      request.nextUrl.searchParams.get("next")
    );
    const destPath = destination.split("?")[0];
    if (destPath !== pathname) {
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  if (isPublicUiPath(pathname)) {
    return response;
  }

  if (isAdminRecruiterPath) {
    if (!user || isAnonymousAuthUser(user)) {
      const login = new URL("/signin", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      login.searchParams.set("role", "admin_recruiter");
      if (user && isAnonymousAuthUser(user)) {
        login.searchParams.set("error", "session");
      }
      const tenant =
        request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
        request.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
      if (tenant && tenant.length >= 2) {
        login.searchParams.set("tenant", tenant);
      }
      return NextResponse.redirect(login);
    }
    if (platformOn && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      await supabase.auth.signOut();
      const login = new URL("/signin", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      login.searchParams.set("role", "admin_recruiter");
      login.searchParams.set("error", "platform");
      const tenant =
        request.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
        request.cookies.get(ONBOARDING_TENANT_SLUG_COOKIE)?.value?.trim().toLowerCase();
      if (tenant && tenant.length >= 2) {
        login.searchParams.set("tenant", tenant);
      }
      return NextResponse.redirect(login);
    }
  }

  /**
   * Applicant onboarding is public (anonymous sign-in happens client-side).
   * Do not apply recruiter platform/auth gates here — that sent applicants to /login.
   */
  if (pathname.startsWith("/application") || pathname === "/worker-onboarding") {
    return ensureApplicationTenantQuery(request, response, tenantLabel);
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
    "/worker-onboarding",
    "/worker-signin",
    "/api/workers",
    "/api/workers/:path*",
    "/api/search-workers",
    "/api/search-workers/:path*",
    "/api/admin/:path*",
    "/godadmin",
    "/godadmin/:path*",
    "/api/godadmin",
    "/api/godadmin/:path*",
  ],
};
