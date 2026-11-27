import { checkStaffSessionActivity } from "@/lib/auth/staff-session-activity";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { loadStaffAccessFlags, staffAccessDeniedMessage } from "@/lib/admin/staff-access";
import { isStaffRole } from "@/lib/auth/app-role";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import {
  clearOAuthNextCookieOptions,
  readOAuthNextPathFromCookieHeader,
  sanitizeOAuthNextPath,
  userHasGoogleIdentity,
} from "@/lib/auth/oauth";
import {
  createStaffSessionProof,
  STAFF_SESSION_PROOF_COOKIE,
  STAFF_SESSION_PROOF_SECONDS,
} from "@/lib/auth/login-otp-proof";
import {
  fetchOwnerOnboardingStatus,
  resolvePostAuthRedirectForUser,
} from "@/lib/auth/owner-onboarding-status";
import { isNexusPlatformUser, isPlatformEnforcementEnabled } from "@/lib/auth/platform-shared";
import { resolveGodAdminServer } from "@/lib/auth/resolve-god-admin-server";
import { resolveAppRoleForUser } from "@/lib/auth/resolve-role";
import { supabaseAuthCookieOptions } from "@/lib/auth/session-cookie";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function applyPendingCookies(response: NextResponse, cookiesToSet: PendingCookie[]) {
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  const clear = clearOAuthNextCookieOptions();
  response.cookies.set(clear.name, clear.value, clear.options);
}

function redirectWithPending(
  request: NextRequest,
  path: string,
  cookiesToSet: PendingCookie[]
) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  applyPendingCookies(response, cookiesToSet);
  return response;
}

function sessionIdFromAccessToken(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as { session_id?: unknown };
    return typeof claims.session_id === "string" && claims.session_id ? claims.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Supabase OAuth PKCE callback. Exchanges `?code=` for a session, then redirects to stored `next`.
 * Existing Google staff users also receive the staff verification cookie (replaces email OTP).
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
    return redirectWithPending(request, `/login?error=oauth_config`, []);
  }

  if (oauthError) {
    const dest = next.startsWith("/signup")
      ? `/signup?error=${encodeURIComponent(oauthError)}`
      : `/login?error=${encodeURIComponent(oauthError)}`;
    return redirectWithPending(request, dest, []);
  }

  if (!code) {
    return redirectWithPending(
      request,
      next.startsWith("/signup")
        ? "/signup?error=oauth_missing_code"
        : "/login?error=oauth_missing_code",
      []
    );
  }

  const cookiesToSet: PendingCookie[] = [];
  const auth = createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  const { data, error } = await auth.auth.exchangeCodeForSession(code);
  if (error) {
    const message = error.message || "oauth_failed";
    const friendly =
      /flow state|already been used|code verifier|pkce/i.test(message)
        ? "Google sign-in expired. Click Google again to retry."
        : message;
    const dest = next.startsWith("/signup")
      ? `/signup?error=${encodeURIComponent(friendly)}`
      : `/login?error=${encodeURIComponent(friendly)}`;
    return redirectWithPending(request, dest, []);
  }

  let destination = next;
  const user = data.user ?? data.session?.user ?? null;
  const sessionId = sessionIdFromAccessToken(data.session?.access_token);

  if (user && sessionId && userHasGoogleIdentity(user)) {
    try {
      const godAdmin = isGodAdminUser(user) || (await resolveGodAdminServer(user));
      const platformOk =
        !isPlatformEnforcementEnabled() || isNexusPlatformUser(user) || godAdmin;
      let staffOk = godAdmin;
      if (platformOk && !godAdmin) {
        const role = await resolveAppRoleForUser(user);
        staffOk = isStaffRole(role);
        if (staffOk) {
          const svc = createServiceRoleClient();
          if (svc) {
            const flags = await loadStaffAccessFlags(svc, user.id);
            if (staffAccessDeniedMessage(flags)) {
              staffOk = false;
            }
          }
        }
      }

      if (platformOk && staffOk && await checkStaffSessionActivity(user.id, sessionId, "start", data.session?.access_token)) {
        cookiesToSet.push({
          name: STAFF_SESSION_PROOF_COOKIE,
          value: createStaffSessionProof(user.id, sessionId),
          options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: STAFF_SESSION_PROOF_SECONDS,
          },
        });

        const onboarding = await fetchOwnerOnboardingStatus(auth, user);
        if (onboarding.signupCompleted) {
          destination = resolvePostAuthRedirectForUser(onboarding, user, next);
        }
      }
    } catch (err) {
      console.error("[auth/callback] google staff bind", err);
    }
  }

  return redirectWithPending(request, destination, cookiesToSet);
}
