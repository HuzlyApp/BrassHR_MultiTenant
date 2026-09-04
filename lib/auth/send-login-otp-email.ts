import { Resend } from "resend";
import {
  createLoginOtp,
  LoginOtpIssueDeniedError,
  LOGIN_OTP_PURPOSE,
} from "@/lib/auth/login-otp-store";
import {
  LOGIN_OTP_LENGTH,
  MAGIC_LINK_OTP_SUBJECT,
} from "@/lib/auth/supabase-magic-link-otp-template";
import { requireResendConfig } from "@/lib/communication/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type SendLoginOtpResult =
  | {
      ok: true;
      resendCount: number;
      maxResends: number;
      expiresInSeconds: number;
      resendAvailableInSeconds: number;
    }
  | {
      ok: false;
      message: string;
      code?: "RATE_LIMIT";
      retryAfterSec?: number;
      resendCount?: number;
      maxResends?: number;
    };

function buildLoginOtpEmailHtml(code: string, expiresInSeconds: number): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
  return `<h2>Your Brass HR login code</h2>
<p>Enter this ${LOGIN_OTP_LENGTH}-digit code on the login screen:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:16px 0;">${code}</p>
<p style="color:#64748b;font-size:14px;">This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If you did not try to log in, ignore this email.</p>`;
}

/**
 * Generates a single-use login OTP (invalidating prior codes) and emails it via Resend.
 * Enforces cooldown and max-resend limits before issuing a new code.
 */
export async function sendSupabaseLoginOtp(
  email: string,
  userId?: string | null
): Promise<SendLoginOtpResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false, message: "Login is not configured. Contact support." };
  }

  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email is not configured";
    return { ok: false, message: msg };
  }

  let created: Awaited<ReturnType<typeof createLoginOtp>>;
  try {
    created = await createLoginOtp(supabase, {
      email,
      userId,
      purpose: LOGIN_OTP_PURPOSE,
    });
  } catch (e) {
    if (e instanceof LoginOtpIssueDeniedError) {
      return {
        ok: false,
        message: e.message,
        code: "RATE_LIMIT",
        retryAfterSec: e.retryAfterSec,
        resendCount: e.resendCount,
        maxResends: e.maxResends,
      };
    }
    const msg = e instanceof Error ? e.message : "Could not create login code";
    console.error("[auth/login-otp/send] createLoginOtp", msg);
    return { ok: false, message: "Could not send login code. Try again." };
  }

  const resend = new Resend(resendConfig.apiKey);
  const { error } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: email.trim().toLowerCase(),
    subject: MAGIC_LINK_OTP_SUBJECT,
    html: buildLoginOtpEmailHtml(created.code, created.expiresInSeconds),
    text: `Your Brass HR login code is ${created.code}. This code expires in ${Math.max(1, Math.round(created.expiresInSeconds / 60))} minute(s).`,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (error) {
    console.error("[auth/login-otp/send] Resend error", { name: error.name });
    return { ok: false, message: error.message || "Could not send login code. Try again." };
  }

  return {
    ok: true,
    resendCount: created.resendCount,
    maxResends: created.maxResends,
    expiresInSeconds: created.expiresInSeconds,
    resendAvailableInSeconds: created.resendAvailableInSeconds,
  };
}
