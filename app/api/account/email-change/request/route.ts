import { NextRequest, NextResponse } from "next/server";
import {
  EMAIL_CHANGE_OTP_PURPOSE,
  normalizeAccountEmail,
  sendEmailChangeOtp,
  validateEmailChange,
} from "@/lib/account/email-change-otp";
import { requireStaffApiSession } from "@/lib/auth/api-session";
import {
  classifyAuthMessage,
  loginAuthErrorResponse,
} from "@/lib/auth/login-api-errors";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 1 of account email change:
 * validate the new email, then send an OTP to the current email address.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession(req);
    if (auth instanceof NextResponse) return auth;

    const body = (await req.json().catch(() => ({}))) as { newEmail?: string };
    const newEmail = typeof body.newEmail === "string" ? body.newEmail : "";
    const currentEmail = normalizeAccountEmail(auth.email ?? auth.authUser.email ?? "");

    const limited = await enforceRateLimit(req, {
      namespace: "account-email-change-request",
      key: `${getClientIp(req)}:${auth.userId}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    const validationError = validateEmailChange(newEmail, currentEmail);
    if (validationError) {
      return loginAuthErrorResponse(validationError, "VALIDATION_ERROR", 400, "email");
    }

    const sent = await sendEmailChangeOtp(currentEmail, auth.userId);
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
      email: currentEmail,
      newEmail: normalizeAccountEmail(newEmail),
      purpose: EMAIL_CHANGE_OTP_PURPOSE,
      resendCount: sent.resendCount,
      maxResends: sent.maxResends,
      expiresInSeconds: sent.expiresInSeconds,
      resendAvailableInSeconds: sent.resendAvailableInSeconds,
    });
  } catch (err: unknown) {
    console.error("[account/email-change/request]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
