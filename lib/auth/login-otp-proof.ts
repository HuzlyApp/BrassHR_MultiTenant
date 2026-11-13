import { createHmac, timingSafeEqual } from "node:crypto";
import { LOGIN_OTP_PROOF_TTL_SECONDS } from "@/lib/auth/login-otp-constants";

const COOKIE_NAME = "brass_login_otp_proof";

function proofSecret(): string {
  const secret = (
    process.env.LOGIN_OTP_PROOF_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  if (!secret) throw new Error("Login verification signing secret is not configured");
  return secret;
}

export const STAFF_SESSION_PROOF_COOKIE = "brass_staff_session_proof";
export const STAFF_SESSION_PROOF_SECONDS = 12 * 60 * 60;

export function createStaffSessionProof(userId: string, sessionId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ purpose: "staff-session", userId, sessionId, exp: now + STAFF_SESSION_PROOF_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", proofSecret()).update(payload).digest("base64url")}`;
}

export function verifyStaffSessionProof(userId: string, sessionId: string, token?: string | null, now = Date.now()): boolean {
  if (!token || !sessionId) return false;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", proofSecret()).update(payload).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.purpose === "staff-session" && parsed.userId === userId && parsed.sessionId === sessionId && Number.isFinite(parsed.exp) && parsed.exp > now;
  } catch { return false; }
}

export function loginOtpProofCookieName(): string {
  return COOKIE_NAME;
}

export function loginOtpProofTtlSeconds(): number {
  const raw = Number(process.env.LOGIN_OTP_PROOF_TTL_SECONDS ?? LOGIN_OTP_PROOF_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3600) : LOGIN_OTP_PROOF_TTL_SECONDS;
}

/** Signed, short-lived proof that OTP was verified for this email. */
export function createLoginOtpProof(email: string, now = Date.now()): string {
  const normalized = email.trim().toLowerCase();
  const exp = now + loginOtpProofTtlSeconds() * 1000;
  const payload = `${normalized}:${exp}`;
  const sig = createHmac("sha256", proofSecret()).update(payload, "utf8").digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyLoginOtpProof(email: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token?.trim()) return false;
  const normalized = email.trim().toLowerCase();
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedSig = createHmac("sha256", proofSecret()).update(payload, "utf8").digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  const [tokenEmail, expRaw] = payload.split(":");
  if (tokenEmail !== normalized) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return true;
}
