import { NextRequest, NextResponse } from "next/server";
import { verifiedSessionIdentity } from "@/lib/auth/staff-session-verification";
import { createStaffSessionProof, loginOtpProofCookieName, verifyLoginOtpProof, STAFF_SESSION_PROOF_COOKIE, STAFF_SESSION_PROOF_SECONDS } from "@/lib/auth/login-otp-proof";

export async function POST(req: NextRequest) {
  const identity = await verifiedSessionIdentity();
  if (!identity || !identity.user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!verifyLoginOtpProof(identity.user.email, req.cookies.get(loginOtpProofCookieName())?.value)) {
    return NextResponse.json({ error: "OTP verification required" }, { status: 403 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_SESSION_PROOF_COOKIE, createStaffSessionProof(identity.user.id, identity.sessionId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STAFF_SESSION_PROOF_SECONDS,
  });
  res.cookies.delete(loginOtpProofCookieName());
  return res;
}
