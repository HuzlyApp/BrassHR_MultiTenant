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

function isPublicUiPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
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

  if (isPublicUiPath(pathname)) {
    return response;
  }

  if (enforceUi && pathname.startsWith("/admin_recruiter")) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(login);
    }
    if (platformOn && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      await supabase.auth.signOut();
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      login.searchParams.set("error", "platform");
      return NextResponse.redirect(login);
    }
  }

  /** Onboarding may be anonymous; enforce platform only when a session exists. */
  if (pathname.startsWith("/application")) {
    if (user && platformOn && !isNexusPlatformUser(user) && !isGodAdminUser(user)) {
      await supabase.auth.signOut();
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      login.searchParams.set("error", "platform");
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin_recruiter/:path*",
    "/application/:path*",
    "/api/workers",
    "/api/workers/:path*",
    "/api/search-workers",
    "/api/search-workers/:path*",
    "/api/admin/:path*",
  ],
};
