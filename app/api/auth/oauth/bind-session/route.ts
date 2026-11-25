import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/auth/app-role";
import {
  createStaffSessionProof,
  STAFF_SESSION_PROOF_COOKIE,
  STAFF_SESSION_PROOF_SECONDS,
} from "@/lib/auth/login-otp-proof";
import { isGodAdminUser } from "@/lib/auth/god-admin";
import { userHasGoogleIdentity } from "@/lib/auth/oauth";
import { isNexusPlatformUser, isPlatformEnforcementEnabled } from "@/lib/auth/platform-shared";
import { resolveGodAdminServer } from "@/lib/auth/resolve-god-admin-server";
import { resolveAppRoleForUser } from "@/lib/auth/resolve-role";
import { verifiedSessionIdentity } from "@/lib/auth/staff-session-verification";
import { loadStaffAccessFlags, staffAccessDeniedMessage } from "@/lib/admin/staff-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * After Google OAuth, mint the staff session proof (Google identity replaces email OTP).
 */
export async function POST() {
  const identity = await verifiedSessionIdentity();
  if (!identity?.user.email) {
    return NextResponse.json({ error: "Sign in with Google first." }, { status: 401 });
  }

  if (!userHasGoogleIdentity(identity.user)) {
    return NextResponse.json({ error: "Google sign-in required." }, { status: 403 });
  }

  const godAdmin =
    isGodAdminUser(identity.user) || (await resolveGodAdminServer(identity.user));

  if (
    isPlatformEnforcementEnabled() &&
    !isNexusPlatformUser(identity.user) &&
    !godAdmin
  ) {
    return NextResponse.json(
      {
        error: "No BrassHR account found for this Google login. Sign up first.",
        code: "ACCOUNT_REQUIRED",
      },
      { status: 403 }
    );
  }

  if (!godAdmin) {
    try {
      const role = await resolveAppRoleForUser(identity.user);
      if (!isStaffRole(role)) {
        return NextResponse.json(
          {
            error: "This account does not have admin access. Use a recruiter or admin account.",
            code: "STAFF_ROLE_REQUIRED",
          },
          { status: 403 }
        );
      }
      const svc = createServiceRoleClient();
      if (svc) {
        const flags = await loadStaffAccessFlags(svc, identity.user.id);
        const denied = staffAccessDeniedMessage(flags);
        if (denied) {
          return NextResponse.json(
            {
              error: denied,
              code: flags.mustChangePassword ? "PASSWORD_SETUP_REQUIRED" : "ACCOUNT_DISABLED",
            },
            { status: 403 }
          );
        }
      }
    } catch (err) {
      console.error("[auth/oauth/bind-session]", err);
      return NextResponse.json(
        { error: "Could not verify account access. Try again." },
        { status: 500 }
      );
    }
  }

  const res = NextResponse.json({
    ok: true,
    email: identity.user.email.trim().toLowerCase(),
  });
  res.cookies.set(
    STAFF_SESSION_PROOF_COOKIE,
    createStaffSessionProof(identity.user.id, identity.sessionId),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STAFF_SESSION_PROOF_SECONDS,
    }
  );
  return res;
}
