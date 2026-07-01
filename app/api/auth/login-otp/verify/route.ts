import { NextRequest, NextResponse } from "next/server";
import {
  loginAuthErrorResponse,
  LOGIN_OTP_INVALID_MESSAGE,
} from "@/lib/auth/login-api-errors";
import { verifyLoginOtp } from "@/lib/auth/login-otp-store";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 2 of Braas login: verify the latest active OTP for the user.
 * On success the client completes sign-in with the stored password.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; code?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    const limited = await enforceRateLimit(req, {
      namespace: "auth-login-otp-verify",
      key: `${getClientIp(req)}:${email || "missing"}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!email) {
      return loginAuthErrorResponse("Email is required.", "VALIDATION_ERROR", 400, "email");
    }
    if (!code) {
      return loginAuthErrorResponse("Code is required.", "VALIDATION_ERROR", 400);
    }

    const supabase = createServiceRoleClient();
    if (!supabase) {
      return loginAuthErrorResponse(
        "Login is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const verified = await verifyLoginOtp(supabase, { email, code });
    if (!verified.ok) {
      return loginAuthErrorResponse(LOGIN_OTP_INVALID_MESSAGE, "OTP_INVALID", 401);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[auth/login-otp/verify]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
