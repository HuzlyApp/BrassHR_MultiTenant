import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "brass_login_otp_proof";
const DEFAULT_TTL_SECONDS = 600;

function proofSecret(): string {
  return (
    process.env.LOGIN_OTP_PROOF_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "brasshr-login-otp-proof"
  );
}

export function loginOtpProofCookieName(): string {
  return COOKIE_NAME;
}

export function loginOtpProofTtlSeconds(): number {
  const raw = Number(process.env.LOGIN_OTP_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3600) : DEFAULT_TTL_SECONDS;
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
