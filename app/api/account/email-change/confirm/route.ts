import { NextRequest, NextResponse } from "next/server";
import {
  EMAIL_CHANGE_OTP_PURPOSE,
  EMAIL_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountEmail,
  validateEmailChange,
} from "@/lib/account/email-change-otp";
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
 * Step 2 of account email change:
 * verify OTP sent to the current email, then update Auth + public.users email.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      newEmail?: string;
    };

    const code = typeof body.code === "string" ? body.code.trim() : "";
    const newEmailRaw = typeof body.newEmail === "string" ? body.newEmail : "";
    const currentEmail = normalizeAccountEmail(auth.email ?? auth.authUser.email ?? "");
    const newEmail = normalizeAccountEmail(newEmailRaw);

    const limited = await enforceRateLimit(req, {
      namespace: "account-email-change-confirm",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!code) {
      return loginAuthErrorResponse("Code is required.", "VALIDATION_ERROR", 400);
    }

    const validationError = validateEmailChange(newEmail, currentEmail);
    if (validationError) {
      return loginAuthErrorResponse(validationError, "VALIDATION_ERROR", 400, "email");
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return loginAuthErrorResponse(
        "Email change is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const verified = await verifyLoginOtp(supabase, {
      email: currentEmail,
      code,
      purpose: EMAIL_CHANGE_OTP_PURPOSE,
    });

    if (!verified.ok) {
      if (verified.reason === "expired") {
        return loginAuthErrorResponse(LOGIN_OTP_EXPIRED_MESSAGE, "OTP_EXPIRED", 401);
      }
      return loginAuthErrorResponse(LOGIN_OTP_INVALID_MESSAGE, "OTP_INVALID", 401);
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(auth.userId, {
      email: newEmail,
      email_confirm: true,
    });

    if (authUpdateError) {
      const msg = authUpdateError.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return loginAuthErrorResponse(
          "That email is already in use by another account.",
          "VALIDATION_ERROR",
          400,
          "email"
        );
      }
      console.error("[account/email-change/confirm] admin.updateUserById", authUpdateError);
      return loginAuthErrorResponse(
        authUpdateError.message || "Could not update email.",
        "UNKNOWN",
        400
      );
    }

    const { error: usersUpdateError } = await supabase
      .from("users")
      .update({ email: newEmail })
      .eq("id", auth.userId);

    if (usersUpdateError) {
      console.error("[account/email-change/confirm] users update", usersUpdateError);
      // Auth email already changed; surface soft failure so UI can still refresh.
    }

    return NextResponse.json({
      ok: true,
      email: newEmail,
      previousEmail: currentEmail,
      message: EMAIL_CHANGE_SUCCESS_MESSAGE,
    });
  } catch (err: unknown) {
    console.error("[account/email-change/confirm]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
