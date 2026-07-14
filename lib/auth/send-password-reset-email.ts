import { Resend } from "resend";
import { findAuthUserIdByEmail } from "@/lib/auth/find-auth-user-by-email";
import { requireResendConfig } from "@/lib/communication/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizeTenantEmail } from "@/lib/tenant/tenant-email-uniqueness";

export type SendPasswordResetResult =
  | { ok: true }
  | { ok: false; message: string; reason?: "not_found" | "invalid" | "rate_limit" | "config" | "send_failed" };

function buildPasswordResetEmailHtml(resetUrl: string): string {
  const safeUrl = resetUrl.replace(/"/g, "&quot;");
  return `<h2>Reset your Brass HR password</h2>
<p>We received a request to reset the password for your account.</p>
<p style="margin:24px 0;">
  <a href="${safeUrl}" style="display:inline-block;background:#BC8B41;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
    Reset Password
  </a>
</p>
<p style="color:#64748b;font-size:14px;">Or copy this link into your browser:</p>
<p style="color:#334155;font-size:13px;word-break:break-all;">${safeUrl}</p>
<p style="color:#64748b;font-size:14px;">If you did not request a password reset, you can ignore this email.</p>`;
}

/**
 * Builds an app-hosted reset URL using hashed_token (verifyOtp on open).
 * Avoids emailing Supabase's /auth/v1/verify action_link — mail scanners often
 * consume that one-time link and the user then sees otp_expired.
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  /** App origin, e.g. http://localhost:3000 or https://www.brasshr.com */
  appOrigin: string;
  /** Optional return path after successful reset (must start with /). */
  returnTo?: string | null;
}): Promise<SendPasswordResetResult> {
  const email = normalizeTenantEmail(params.email);
  if (!email.includes("@")) {
    return { ok: false, message: "Enter a valid email address.", reason: "invalid" };
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return {
      ok: false,
      message: "Password reset is not configured. Contact support.",
      reason: "config",
    };
  }

  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email is not configured";
    return { ok: false, message: msg, reason: "config" };
  }

  const userId = await findAuthUserIdByEmail(supabase, email);
  if (!userId) {
    return {
      ok: false,
      message: "No account found with this email. Check the address and try again.",
      reason: "not_found",
    };
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  const hashedToken = linkData?.properties?.hashed_token?.trim();
  if (linkError || !hashedToken) {
    const message = (linkError?.message || "").toLowerCase();
    if (
      message.includes("security purposes") ||
      message.includes("only request this after") ||
      message.includes("rate limit")
    ) {
      return {
        ok: false,
        message: "Please wait a minute before requesting another reset link, then try again.",
        reason: "rate_limit",
      };
    }
    if (message.includes("not found") || message.includes("unable to find")) {
      return {
        ok: false,
        message: "No account found with this email. Check the address and try again.",
        reason: "not_found",
      };
    }
    console.error("[auth/forgot-password] generateLink", linkError?.message);
    return {
      ok: false,
      message: "Could not create a reset link. Try again.",
      reason: "send_failed",
    };
  }

  const resetUrl = new URL("/reset-password", params.appOrigin);
  resetUrl.searchParams.set("token_hash", hashedToken);
  resetUrl.searchParams.set("type", "recovery");
  const returnTo = params.returnTo?.trim();
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    resetUrl.searchParams.set("return", returnTo);
  }

  const href = resetUrl.toString();
  const resend = new Resend(resendConfig.apiKey);
  const { error: sendError } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: email,
    subject: "Reset your Brass HR password",
    html: buildPasswordResetEmailHtml(href),
    text: `Reset your Brass HR password: ${href}\n\nIf you did not request this, ignore this email.`,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (sendError) {
    console.error("[auth/forgot-password] Resend error", { name: sendError.name });
    return {
      ok: false,
      message: sendError.message || "Could not send reset email. Try again.",
      reason: "send_failed",
    };
  }

  return { ok: true };
}
