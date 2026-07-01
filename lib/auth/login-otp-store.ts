import { createHash, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGIN_OTP_LENGTH } from "@/lib/auth/supabase-magic-link-otp-template";

export const LOGIN_OTP_PURPOSE = "login" as const;

export type LoginOtpPurpose = typeof LOGIN_OTP_PURPOSE | string;

const DEFAULT_TTL_SECONDS = 600;

export function loginOtpTtlSeconds(): number {
  const raw = Number(process.env.LOGIN_OTP_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 3600) : DEFAULT_TTL_SECONDS;
}

export function loginOtpExpiryIso(now = new Date()): string {
  return new Date(now.getTime() + loginOtpTtlSeconds() * 1000).toISOString();
}

export function generateOtpCode(length = LOGIN_OTP_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

function loginOtpPepper(): string {
  return (
    process.env.LOGIN_OTP_PEPPER?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "brasshr-login-otp"
  );
}

export function hashLoginOtp(params: { email: string; purpose: string; code: string }): string {
  const email = params.email.trim().toLowerCase();
  const purpose = params.purpose.trim();
  const code = params.code.trim();
  return createHash("sha256")
    .update(`${loginOtpPepper()}:${email}:${purpose}:${code}`, "utf8")
    .digest("hex");
}

export function normalizeLoginOtpEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidOtpCodeFormat(code: string): boolean {
  return new RegExp(`^\\d{${LOGIN_OTP_LENGTH}}$`).test(code.trim());
}

export async function invalidatePreviousLoginOtps(
  supabase: SupabaseClient,
  params: { email: string; purpose: string; now?: string }
): Promise<void> {
  const email = normalizeLoginOtpEmail(params.email);
  const now = params.now ?? new Date().toISOString();
  const { error } = await supabase
    .from("auth_login_otps")
    .update({ invalidated_at: now })
    .eq("email", email)
    .eq("purpose", params.purpose)
    .is("used_at", null)
    .is("invalidated_at", null);

  if (error) throw error;
}

export type CreateLoginOtpParams = {
  email: string;
  userId?: string | null;
  purpose?: string;
  now?: Date;
  code?: string;
};

export type CreateLoginOtpResult = {
  code: string;
  expiresAt: string;
};

export async function createLoginOtp(
  supabase: SupabaseClient,
  params: CreateLoginOtpParams
): Promise<CreateLoginOtpResult> {
  const email = normalizeLoginOtpEmail(params.email);
  const purpose = params.purpose ?? LOGIN_OTP_PURPOSE;
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();

  await invalidatePreviousLoginOtps(supabase, { email, purpose, now: nowIso });

  const code = params.code ?? generateOtpCode();
  const otpHash = hashLoginOtp({ email, purpose, code });
  const expiresAt = loginOtpExpiryIso(now);

  const { error } = await supabase.from("auth_login_otps").insert({
    email,
    user_id: params.userId ?? null,
    purpose,
    otp_hash: otpHash,
    created_at: nowIso,
    expires_at: expiresAt,
  });

  if (error) throw error;

  return { code, expiresAt };
}

export type VerifyLoginOtpResult = { ok: true } | { ok: false; reason: "invalid" | "error" };

export async function verifyLoginOtp(
  supabase: SupabaseClient,
  params: { email: string; code: string; purpose?: string }
): Promise<VerifyLoginOtpResult> {
  const email = normalizeLoginOtpEmail(params.email);
  const purpose = params.purpose ?? LOGIN_OTP_PURPOSE;
  const code = params.code.trim();

  if (!isValidOtpCodeFormat(code)) {
    return { ok: false, reason: "invalid" };
  }

  const otpHash = hashLoginOtp({ email, purpose, code });
  const { data, error } = await supabase.rpc("consume_auth_login_otp", {
    p_email: email,
    p_purpose: purpose,
    p_otp_hash: otpHash,
  });

  if (error) {
    return { ok: false, reason: "error" };
  }

  return data === true ? { ok: true } : { ok: false, reason: "invalid" };
}
