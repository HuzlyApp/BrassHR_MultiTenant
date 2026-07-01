import { Resend } from "resend";
import {
  createLoginOtp,
  LOGIN_OTP_PURPOSE,
} from "@/lib/auth/login-otp-store";
import {
  LOGIN_OTP_LENGTH,
  MAGIC_LINK_OTP_SUBJECT,
} from "@/lib/auth/supabase-magic-link-otp-template";
import { requireResendConfig } from "@/lib/communication/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type SendLoginOtpResult = { ok: true } | { ok: false; message: string };

function buildLoginOtpEmailHtml(code: string): string {
  return `<h2>Your Brass HR login code</h2>
<p>Enter this ${LOGIN_OTP_LENGTH}-digit code on the login screen:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:8px;margin:16px 0;">${code}</p>
<p style="color:#64748b;font-size:14px;">This code expires soon. If you did not try to log in, ignore this email.</p>`;
}

/**
 * Generates a single-use login OTP (invalidating prior codes) and emails it via Resend.
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

  let code: string;
  try {
    const created = await createLoginOtp(supabase, {
      email,
      userId,
      purpose: LOGIN_OTP_PURPOSE,
    });
    code = created.code;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create login code";
    console.error("[auth/login-otp/send] createLoginOtp", msg);
    return { ok: false, message: "Could not send login code. Try again." };
  }

  const resend = new Resend(resendConfig.apiKey);
  const { error } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: email.trim().toLowerCase(),
    subject: MAGIC_LINK_OTP_SUBJECT,
    html: buildLoginOtpEmailHtml(code),
    text: `Your Brass HR login code is ${code}. This code expires soon.`,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (error) {
    console.error("[auth/login-otp/send] Resend error", { name: error.name });
    return { ok: false, message: error.message || "Could not send login code. Try again." };
  }

  return { ok: true };
}
