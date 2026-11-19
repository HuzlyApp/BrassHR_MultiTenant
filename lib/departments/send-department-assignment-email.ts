import { Resend } from "resend";
import { requireResendConfig } from "@/lib/communication/env";

export type SendDepartmentAssignmentEmailResult =
  | { ok: true }
  | { ok: false; message: string; reason: "config" | "rate_limit" | "send_failed" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDepartmentAssignmentEmail(params: {
  email: string;
  memberName: string;
  departmentName: string;
  tenantName: string;
  roleLabel?: string | null;
}): Promise<SendDepartmentAssignmentEmailResult> {
  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email is not configured";
    return { ok: false, message, reason: "config" };
  }

  const name = escapeHtml(params.memberName || "there");
  const department = escapeHtml(params.departmentName);
  const tenant = escapeHtml(params.tenantName);
  const role = params.roleLabel?.trim() ? escapeHtml(params.roleLabel.trim()) : null;
  const subject = `You've been added to ${params.departmentName} at ${params.tenantName}`;
  const html = `<h2>Department assignment</h2>
<p>Hi ${name},</p>
<p>You have been added to the <strong>${department}</strong> department${
    role ? ` as <strong>${role}</strong>` : ""
  } at <strong>${tenant}</strong>.</p>
<p style="color:#64748b;font-size:14px;">If you were not expecting this, contact your administrator.</p>`;
  const text = `Hi ${params.memberName || "there"}, you have been added to ${params.departmentName} at ${params.tenantName}.`;

  const resend = new Resend(resendConfig.apiKey);
  const { error: sendError } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: params.email,
    subject,
    html,
    text,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (sendError) {
    console.error("[department-assignment] Resend error", { name: sendError.name });
    const message = (sendError.message || "").toLowerCase();
    if (message.includes("rate") || message.includes("too many")) {
      return { ok: false, message: "Please wait before sending another email.", reason: "rate_limit" };
    }
    return {
      ok: false,
      message: sendError.message || "Could not send assignment email.",
      reason: "send_failed",
    };
  }

  return { ok: true };
}
