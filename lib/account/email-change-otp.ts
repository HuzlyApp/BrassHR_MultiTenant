import { Resend } from "resend";
import {
  createLoginOtp,
  LoginOtpIssueDeniedError,
} from "@/lib/auth/login-otp-store";
import { LOGIN_OTP_LENGTH } from "@/lib/auth/supabase-magic-link-otp-template";
import { requireResendConfig } from "@/lib/communication/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  EMAIL_CHANGE_OTP_PURPOSE,
  EMAIL_CHANGE_OTP_SUBJECT,
  normalizeAccountEmail,
} from "@/lib/account/email-change";

export {
  EMAIL_CHANGE_OTP_PURPOSE,
  EMAIL_CHANGE_OTP_SUBJECT,
  EMAIL_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountEmail,
  validateEmailChange,
} from "@/lib/account/email-change";

export type SendEmailChangeOtpResult =
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

function buildEmailChangeOtpEmailHtml(code: string, expiresInSeconds: number): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
  return `<h2>Your Brass HR email change code</h2>
<p>Enter this ${LOGIN_OTP_LENGTH}-digit code to confirm changing the email on your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:16px 0;">${code}</p>
<p style="color:#64748b;font-size:14px;">This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If you did not request an email change, ignore this email.</p>`;
}

/**
 * Issues a single-use email-change OTP and emails it to the current address via Resend.
 * Server-only — imports Node crypto via the OTP store.
 */
export async function sendEmailChangeOtp(
  currentEmail: string,
  userId?: string | null
): Promise<SendEmailChangeOtpResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false, message: "Email change is not configured. Contact support." };
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
      email: currentEmail,
      userId,
      purpose: EMAIL_CHANGE_OTP_PURPOSE,
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
    const msg = e instanceof Error ? e.message : "Could not create verification code";
    console.error("[account/email-change] createLoginOtp", msg);
    return { ok: false, message: "Could not send verification code. Try again." };
  }

  const to = normalizeAccountEmail(currentEmail);
  const resend = new Resend(resendConfig.apiKey);
  const { error } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to,
    subject: EMAIL_CHANGE_OTP_SUBJECT,
    html: buildEmailChangeOtpEmailHtml(created.code, created.expiresInSeconds),
    text: `Your Brass HR email change code is ${created.code}. This code expires in ${Math.max(1, Math.round(created.expiresInSeconds / 60))} minute(s).`,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (error) {
    console.error("[account/email-change] Resend error", { name: error.name });
    return { ok: false, message: error.message || "Could not send verification code. Try again." };
  }

  return {
    ok: true,
    resendCount: created.resendCount,
    maxResends: created.maxResends,
    expiresInSeconds: created.expiresInSeconds,
    resendAvailableInSeconds: created.resendAvailableInSeconds,
  };
}
