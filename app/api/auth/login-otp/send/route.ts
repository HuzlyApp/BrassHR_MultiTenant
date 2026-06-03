import { NextRequest, NextResponse } from "next/server";
import {
  classifyAuthMessage,
  loginAuthErrorResponse,
} from "@/lib/auth/login-api-errors";
import { resolveGodAdminServer } from "@/lib/auth/resolve-god-admin-server";
import { sendSupabaseLoginOtp } from "@/lib/auth/send-login-otp-email";
import { createEphemeralAuthClient } from "@/lib/supabase/ephemeral-auth-client";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Step 1 of Braas login: validate email/password, check god admin via API/DB.
 * God admin → no OTP. Everyone else → Supabase sends email OTP.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const limited = await enforceRateLimit(req, {
      namespace: "auth-login-otp",
      key: `${getClientIp(req)}:${email || "missing"}`,
      limit: Number(process.env.RATE_LIMIT_AUTH_PER_15_MIN ?? 10),
      windowMs: 15 * 60 * 1000,
      failClosed: true,
    });
    if (limited) return limited;

    if (!email && !password) {
      return loginAuthErrorResponse("Email and password are required.", "VALIDATION_ERROR", 400);
    }
    if (!email) {
      return loginAuthErrorResponse("Email is required.", "VALIDATION_ERROR", 400, "email");
    }
    if (!password) {
      return loginAuthErrorResponse("Password is required.", "VALIDATION_ERROR", 400, "password");
    }

    const auth = createEphemeralAuthClient();
    if (!auth) {
      return loginAuthErrorResponse(
        "Login is not configured. Contact support.",
        "AUTH_NOT_CONFIGURED",
        503
      );
    }

    const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      const classified = classifyAuthMessage(signInError?.message);
      return loginAuthErrorResponse(classified.error, classified.code, 401, classified.field);
    }

    const godAdmin = await resolveGodAdminServer(signInData.user);

    if (godAdmin) {
      await auth.auth.signOut();
      return NextResponse.json({
        ok: true,
        godAdmin: true,
        requiresOtp: false,
        email,
      });
    }

    await auth.auth.signOut();

    const sent = await sendSupabaseLoginOtp(email);
    if (!sent.ok) {
      const classified = classifyAuthMessage(sent.message);
      return loginAuthErrorResponse(
        classified.error,
        classified.code === "UNKNOWN" ? "OTP_SEND_FAILED" : classified.code,
        classified.code === "RATE_LIMIT" ? 429 : 400,
        classified.field
      );
    }

    return NextResponse.json({
      ok: true,
      godAdmin: false,
      requiresOtp: true,
      email,
      otpDelivery: "supabase",
    });
  } catch (err: unknown) {
    console.error("[auth/login-otp/send]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
