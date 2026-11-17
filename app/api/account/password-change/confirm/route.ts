import { NextRequest, NextResponse } from "next/server";
import { PASSWORD_CHANGE_OTP_PURPOSE } from "@/lib/account/password-change-otp";
import { validatePasswordUpdate } from "@/lib/account/password-update";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  LOGIN_OTP_EXPIRED_MESSAGE,
  LOGIN_OTP_INVALID_MESSAGE,
  loginAuthErrorResponse,
} from "@/lib/auth/login-api-errors";
import { verifyLoginOtp } from "@/lib/auth/login-otp-store";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 2 of account password change: verify the email OTP for purpose password_change.
 * Password is then updated by the client with the existing session (avoids logout).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const code = typeof body.code === "string" ? body.code.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    const email = (auth.email ?? auth.authUser.email ?? "").trim().toLowerCase();

    const limited = await enforceRateLimit(req, {
      namespace: "account-password-change-confirm",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!email) {
      return loginAuthErrorResponse(
        "No email is available on this account.",
        "VALIDATION_ERROR",
        400,
        "email"
      );
    }
    if (!code) {
      return loginAuthErrorResponse("Code is required.", "VALIDATION_ERROR", 400);
    }

    const validationError = validatePasswordUpdate(newPassword, confirmPassword);
    if (validationError) {
      return loginAuthErrorResponse(validationError, "VALIDATION_ERROR", 400);
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return loginAuthErrorResponse(
        "Password change is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const verified = await verifyLoginOtp(supabase, {
      email,
      code,
      purpose: PASSWORD_CHANGE_OTP_PURPOSE,
    });

    if (!verified.ok) {
      if (verified.reason === "expired") {
        return loginAuthErrorResponse(LOGIN_OTP_EXPIRED_MESSAGE, "OTP_EXPIRED", 401);
      }
      return loginAuthErrorResponse(LOGIN_OTP_INVALID_MESSAGE, "OTP_INVALID", 401);
    }

    return NextResponse.json({ ok: true, email });
  } catch (err: unknown) {
    console.error("[account/password-change/confirm]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
