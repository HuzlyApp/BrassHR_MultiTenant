import { Resend } from "resend";
import { emailDeliveryValidationMessage } from "@/lib/email/email-domain";
import { requireResendConfig } from "@/lib/communication/env";

export type SendStaffInviteEmailResult =
  | { ok: true }
  | { ok: false; message: string; reason: "config" | "rate_limit" | "send_failed" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteHtml(params: {
  firstName: string;
  tenantName: string;
  roleLabel: string;
  actionUrl: string;
  existingAccount: boolean;
}): string {
  const safeUrl = params.actionUrl.replace(/"/g, "&quot;");
  const name = escapeHtml(params.firstName || "there");
  const tenant = escapeHtml(params.tenantName);
  const role = escapeHtml(params.roleLabel);
  if (params.existingAccount) {
    return `<h2>You've been added to ${tenant}</h2>
<p>Hi ${name},</p>
<p>You now have <strong>${role}</strong> access to ${tenant} on Brass HR. Sign in with your existing account to get started.</p>
<p style="margin:24px 0;">
  <a href="${safeUrl}" style="display:inline-block;background:#BC8B41;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
    Sign in
  </a>
</p>
<p style="color:#64748b;font-size:14px;">If you did not expect this invitation, you can ignore this email.</p>`;
  }
  return `<h2>You're invited to join ${tenant}</h2>
<p>Hi ${name},</p>
<p>You've been invited as a <strong>${role}</strong> on Brass HR. Set your password using the secure link below. This link expires and can be used only once.</p>
<p style="margin:24px 0;">
  <a href="${safeUrl}" style="display:inline-block;background:#BC8B41;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">
    Set password and activate account
  </a>
</p>
<p style="color:#64748b;font-size:14px;">Or copy this link into your browser:</p>
<p style="color:#334155;font-size:13px;word-break:break-all;">${safeUrl}</p>
<p style="color:#64748b;font-size:14px;">If you did not expect this invitation, you can ignore this email.</p>`;
}

export async function sendStaffInviteEmail(params: {
  email: string;
  firstName: string;
  tenantName: string;
  roleLabel: string;
  actionUrl: string;
  existingAccount: boolean;
}): Promise<SendStaffInviteEmailResult> {
  const recipientError = emailDeliveryValidationMessage(params.email);
  if (recipientError) return { ok: false, message: recipientError, reason: "send_failed" };
  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email is not configured";
    return { ok: false, message: msg, reason: "config" };
  }

  const resend = new Resend(resendConfig.apiKey);
  const subject = params.existingAccount
    ? `You've been added to ${params.tenantName} on Brass HR`
    : `You're invited to join ${params.tenantName} on Brass HR`;
  const text = params.existingAccount
    ? `You've been added to ${params.tenantName} as a ${params.roleLabel}. Sign in: ${params.actionUrl}`
    : `You've been invited to ${params.tenantName} as a ${params.roleLabel}. Set your password: ${params.actionUrl}`;

  const { error: sendError } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: params.email,
    subject,
    html: buildInviteHtml(params),
    text,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (sendError) {
    console.error("[staff-invite] Resend error", { name: sendError.name });
    const message = (sendError.message || "").toLowerCase();
    if (message.includes("rate") || message.includes("too many")) {
      return { ok: false, message: "Please wait before sending another invitation.", reason: "rate_limit" };
    }
    return {
      ok: false,
      message: "Invitation email could not be sent. Check the recipient address and your email integration, then try again.",
      reason: "send_failed",
    };
  }

  return { ok: true };
}

export function buildStaffActivationUrl(params: {
  appOrigin: string;
  hashedToken: string;
  tenantSlug?: string | null;
}): string {
  // First-time invite activation uses /set-password (not forgot-password /reset-password).
  const activationUrl = new URL("/set-password", params.appOrigin);
  activationUrl.searchParams.set("token_hash", params.hashedToken);
  activationUrl.searchParams.set("type", "recovery");
  activationUrl.searchParams.set("return", "/admin");
  const tenant = params.tenantSlug?.trim().toLowerCase();
  if (tenant && tenant.length >= 2) {
    activationUrl.searchParams.set("tenant", tenant);
  }
  return activationUrl.toString();
}

export function buildStaffSignInUrl(params: { appOrigin: string; tenantSlug?: string | null }): string {
  const url = new URL("/admin", params.appOrigin);
  const tenant = params.tenantSlug?.trim().toLowerCase();
  if (tenant && tenant.length >= 2) {
    url.searchParams.set("tenant", tenant);
  }
  return url.toString();
}
