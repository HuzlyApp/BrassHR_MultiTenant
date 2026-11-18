import { NextRequest, NextResponse } from "next/server";
import {
  PHONE_CHANGE_OTP_PURPOSE,
  normalizeAccountPhone,
  sendPhoneChangeOtp,
  validatePhoneChange,
} from "@/lib/account/phone-change-otp";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  classifyAuthMessage,
  loginAuthErrorResponse,
} from "@/lib/auth/login-api-errors";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 1 of account phone change:
 * validate the new phone, then send an OTP to the account email.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { newPhone?: string };
    const newPhoneRaw = typeof body.newPhone === "string" ? body.newPhone : "";
    const accountEmail = (auth.email ?? auth.authUser.email ?? "").trim().toLowerCase();

    const limited = await enforceRateLimit(req, {
      namespace: "account-phone-change-request",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!accountEmail) {
      return loginAuthErrorResponse(
        "No email is available on this account to send a verification code.",
        "VALIDATION_ERROR",
        400,
        "email"
      );
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

    const sent = await sendPhoneChangeOtp(accountEmail, auth.userId);
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
      email: accountEmail,
      newPhone: normalizeAccountPhone(newPhoneRaw),
      purpose: PHONE_CHANGE_OTP_PURPOSE,
      resendCount: sent.resendCount,
      maxResends: sent.maxResends,
      expiresInSeconds: sent.expiresInSeconds,
      resendAvailableInSeconds: sent.resendAvailableInSeconds,
    });
  } catch (err: unknown) {
    console.error("[account/phone-change/request]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
