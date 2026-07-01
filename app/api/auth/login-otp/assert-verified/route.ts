import { NextRequest, NextResponse } from "next/server";
import { loginAuthErrorResponse } from "@/lib/auth/login-api-errors";
import {
  loginOtpProofCookieName,
  verifyLoginOtpProof,
} from "@/lib/auth/login-otp-proof";

export const runtime = "nodejs";

/** Confirms the browser completed OTP verification before password sign-in continues. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return loginAuthErrorResponse("Email is required.", "VALIDATION_ERROR", 400, "email");
    }

    const proof = req.cookies.get(loginOtpProofCookieName())?.value;
    if (!verifyLoginOtpProof(email, proof)) {
      return loginAuthErrorResponse(
        "Verification expired or missing. Request a new code and try again.",
        "OTP_INVALID",
        401
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[auth/login-otp/assert-verified]", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return loginAuthErrorResponse(msg, "UNKNOWN", 500);
  }
}
