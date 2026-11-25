import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  clearOAuthNextCookieOptions,
  readOAuthNextPathFromCookieHeader,
  sanitizeOAuthNextPath,
} from "@/lib/auth/oauth";
import { supabaseAuthCookieOptions } from "@/lib/auth/session-cookie";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

function redirectWithCookies(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  const clear = clearOAuthNextCookieOptions();
  response.cookies.set(clear.name, clear.value, clear.options);
  return response;
}

/**
 * Supabase OAuth PKCE callback. Exchanges `?code=` for a session, then redirects to stored `next`.
 */
export async function GET(request: NextRequest) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  const code = request.nextUrl.searchParams.get("code")?.trim();
  const oauthError =
    request.nextUrl.searchParams.get("error_description")?.trim() ||
    request.nextUrl.searchParams.get("error")?.trim();
  const next = sanitizeOAuthNextPath(
    request.nextUrl.searchParams.get("next") ||
      readOAuthNextPathFromCookieHeader(request.headers.get("cookie")),
    "/login"
  );

  if (!url || !key) {
    return redirectWithCookies(request, `/login?error=oauth_config`);
  }

  if (oauthError) {
    const dest = next.startsWith("/signup")
      ? `/signup?error=${encodeURIComponent(oauthError)}`
      : `/login?error=${encodeURIComponent(oauthError)}`;
    return redirectWithCookies(request, dest);
  }

  if (!code) {
    return redirectWithCookies(
      request,
      next.startsWith("/signup")
        ? "/signup?error=oauth_missing_code"
        : "/login?error=oauth_missing_code"
    );
  }

  const response = redirectWithCookies(request, next);
  const auth = createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });

  const { error } = await auth.auth.exchangeCodeForSession(code);
  if (error) {
    const message = error.message || "oauth_failed";
    // Common when the callback is hit twice or Site URL redirected away from localhost.
    const friendly =
      /flow state|already been used|code verifier|pkce/i.test(message)
        ? "Google sign-in expired. Click Google again to retry."
        : message;
    const dest = next.startsWith("/signup")
      ? `/signup?error=${encodeURIComponent(friendly)}`
      : `/login?error=${encodeURIComponent(friendly)}`;
    return redirectWithCookies(request, dest);
  }

  return response;
}
