import { NextRequest, NextResponse } from "next/server";
import {
  PHONE_CHANGE_OTP_PURPOSE,
  PHONE_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountPhone,
  validatePhoneChange,
} from "@/lib/account/phone-change-otp";
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
 * Step 2 of account phone change:
 * verify OTP sent to the account email, then update public.users.phone.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      newPhone?: string;
    };

    const code = typeof body.code === "string" ? body.code.trim() : "";
    const newPhoneRaw = typeof body.newPhone === "string" ? body.newPhone : "";
    const accountEmail = (auth.email ?? auth.authUser.email ?? "").trim().toLowerCase();

    const limited = await enforceRateLimit(req, {
      namespace: "account-phone-change-confirm",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!accountEmail) {
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

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return loginAuthErrorResponse(
        "Phone change is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("phone")
      .eq("id", auth.userId)
      .maybeSingle();

    const currentPhone = typeof profile?.phone === "string" ? profile.phone : "";
    const validationError = validatePhoneChange(newPhoneRaw, currentPhone);
    if (validationError) {
      return loginAuthErrorResponse(validationError, "VALIDATION_ERROR", 400);
    }

    const verified = await verifyLoginOtp(supabase, {
      email: accountEmail,
      code,
      purpose: PHONE_CHANGE_OTP_PURPOSE,
    });

    if (!verified.ok) {
      if (verified.reason === "expired") {
        return loginAuthErrorResponse(LOGIN_OTP_EXPIRED_MESSAGE, "OTP_EXPIRED", 401);
      }
      return loginAuthErrorResponse(LOGIN_OTP_INVALID_MESSAGE, "OTP_INVALID", 401);
    }

    const phoneToSave = normalizeAccountPhone(newPhoneRaw);
    const { error: usersUpdateError } = await supabase
      .from("users")
      .update({ phone: phoneToSave, updated_at: new Date().toISOString() })
      .eq("id", auth.userId);

    if (usersUpdateError) {
      console.error("[account/phone-change/confirm] users update", usersUpdateError);
      return loginAuthErrorResponse(
        usersUpdateError.message || "Could not update phone number.",
        "UNKNOWN",
        400
      );
    }

    return NextResponse.json({
      ok: true,
      phone: phoneToSave,
      message: PHONE_CHANGE_SUCCESS_MESSAGE,
    });
  } catch (err: unknown) {
    console.error("[account/phone-change/confirm]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
