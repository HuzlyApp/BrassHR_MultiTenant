import { Resend } from "resend";
import {
  createLoginOtp,
  LoginOtpIssueDeniedError,
} from "@/lib/auth/login-otp-store";
import { LOGIN_OTP_LENGTH } from "@/lib/auth/supabase-magic-link-otp-template";
import { requireResendConfig } from "@/lib/communication/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  PHONE_CHANGE_OTP_PURPOSE,
  PHONE_CHANGE_OTP_SUBJECT,
} from "@/lib/account/phone-change";

export {
  PHONE_CHANGE_OTP_PURPOSE,
  PHONE_CHANGE_OTP_SUBJECT,
  PHONE_CHANGE_SUCCESS_MESSAGE,
  normalizeAccountPhone,
  validatePhoneChange,
} from "@/lib/account/phone-change";

export type SendPhoneChangeOtpResult =
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

function buildPhoneChangeOtpEmailHtml(code: string, expiresInSeconds: number): string {
  const minutes = Math.max(1, Math.round(expiresInSeconds / 60));
  return `<h2>Your Brass HR phone change code</h2>
<p>Enter this ${LOGIN_OTP_LENGTH}-digit code to confirm updating the phone number on your account:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:16px 0;">${code}</p>
<p style="color:#64748b;font-size:14px;">This code expires in ${minutes} minute${minutes === 1 ? "" : "s"}. If you did not request a phone change, ignore this email.</p>`;
}

/**
 * Issues a single-use phone-change OTP and emails it to the account email via Resend.
 * Server-only — imports Node crypto via the OTP store.
 */
export async function sendPhoneChangeOtp(
  accountEmail: string,
  userId?: string | null
): Promise<SendPhoneChangeOtpResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { ok: false, message: "Phone change is not configured. Contact support." };
  }

  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email is not configured";
    return { ok: false, message: msg };
  }

  const email = accountEmail.trim().toLowerCase();
  let created: Awaited<ReturnType<typeof createLoginOtp>>;
  try {
    created = await createLoginOtp(supabase, {
      email,
      userId,
      purpose: PHONE_CHANGE_OTP_PURPOSE,
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
    console.error("[account/phone-change] createLoginOtp", msg);
    return { ok: false, message: "Could not send verification code. Try again." };
  }

  const resend = new Resend(resendConfig.apiKey);
  const { error } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: email,
    subject: PHONE_CHANGE_OTP_SUBJECT,
    html: buildPhoneChangeOtpEmailHtml(created.code, created.expiresInSeconds),
    text: `Your Brass HR phone change code is ${created.code}. This code expires in ${Math.max(1, Math.round(created.expiresInSeconds / 60))} minute(s).`,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (error) {
    console.error("[account/phone-change] Resend error", { name: error.name });
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
