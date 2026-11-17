import { NextRequest, NextResponse } from "next/server";
import { PASSWORD_CHANGE_OTP_PURPOSE, sendPasswordChangeOtp } from "@/lib/account/password-change-otp";
import { validatePasswordUpdate } from "@/lib/account/password-update";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  classifyAuthMessage,
  loginAuthErrorResponse,
} from "@/lib/auth/login-api-errors";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral-auth-client";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 1 of account password change:
 * validate new password, verify current password (ephemeral — does not touch browser session),
 * then email a password_change OTP.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    const email = (auth.email ?? auth.authUser.email ?? "").trim().toLowerCase();

    const limited = await enforceRateLimit(req, {
      namespace: "account-password-change-request",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!email) {
      return loginAuthErrorResponse(
        "No email is available on this account to verify the current password.",
        "VALIDATION_ERROR",
        400,
        "email"
      );
    }
    if (!currentPassword.trim()) {
      return loginAuthErrorResponse(
        "Enter your current password to continue.",
        "VALIDATION_ERROR",
        400,
        "password"
      );
    }

    const validationError = validatePasswordUpdate(newPassword, confirmPassword);
    if (validationError) {
      return loginAuthErrorResponse(validationError, "VALIDATION_ERROR", 400);
    }

    if (currentPassword === newPassword) {
      return loginAuthErrorResponse(
        "New password should be different from the old password.",
        "VALIDATION_ERROR",
        400
      );
    }

    const ephemeral = createEphemeralAuthClient();
    if (!ephemeral) {
      return loginAuthErrorResponse(
        "Password change is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const { data: signInData, error: signInError } = await ephemeral.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    // Default signOut scope is "global" and revokes EVERY session for the user
    // (including the browser tab). Always use "local" here so only this
    // ephemeral verification session is cleared.
    const clearEphemeralSession = async () => {
      await ephemeral.auth.signOut({ scope: "local" });
    };

    if (signInError || !signInData.user) {
      return loginAuthErrorResponse("Current password is incorrect.", "INVALID_CREDENTIALS", 401, "password");
    }

    if (signInData.user.id !== auth.userId) {
      await clearEphemeralSession();
      return loginAuthErrorResponse("Current password is incorrect.", "INVALID_CREDENTIALS", 401, "password");
    }

    await clearEphemeralSession();

    const sent = await sendPasswordChangeOtp(email, auth.userId);
    if (!sent.ok) {
      if (sent.code === "RATE_LIMIT") {
        return loginAuthErrorResponse(sent.message, "RATE_LIMIT", 429, null, {
          headers: {
            "Retry-After": String(sent.retryAfterSec ?? 30),
          },
          retryAfterSec: sent.retryAfterSec,
        });
      }
      const classified = classifyAuthMessage(sent.message);
      return loginAuthErrorResponse(
        classified.error,
        classified.code === "UNKNOWN" ? "OTP_SEND_FAILED" : classified.code,
        classified.code === "RATE_LIMIT" ? 429 : 400,
        classified.field,
        {
          ...(typeof sent.retryAfterSec === "number" ? { retryAfterSec: sent.retryAfterSec } : {}),
        }
      );
    }

    return NextResponse.json({
      ok: true,
      email,
      purpose: PASSWORD_CHANGE_OTP_PURPOSE,
      resendCount: sent.resendCount,
      maxResends: sent.maxResends,
      expiresInSeconds: sent.expiresInSeconds,
      resendAvailableInSeconds: sent.resendAvailableInSeconds,
    });
  } catch (err: unknown) {
    console.error("[account/password-change/request]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
