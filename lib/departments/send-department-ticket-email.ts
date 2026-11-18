import { Resend } from "resend";
import { requireResendConfig } from "@/lib/communication/env";
import { supportTicketStaffLink } from "@/lib/notifications/create-notification";

export type SendDepartmentTicketEmailResult =
  | { ok: true }
  | { ok: false; message: string; reason: "config" | "rate_limit" | "send_failed" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDepartmentTicketEmail(params: {
  email: string;
  departmentName: string;
  tenantName: string;
  ticketId: string;
  subject: string;
  description?: string | null;
}): Promise<SendDepartmentTicketEmailResult> {
  let resendConfig: ReturnType<typeof requireResendConfig>;
  try {
    resendConfig = requireResendConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email is not configured";
    return { ok: false, message, reason: "config" };
  }

  const department = escapeHtml(params.departmentName);
  const tenant = escapeHtml(params.tenantName);
  const subject = escapeHtml(params.subject);
  const description = params.description?.trim()
    ? escapeHtml(params.description.trim().slice(0, 2000))
    : null;
  const linkPath = supportTicketStaffLink(params.ticketId);
  const mailSubject = `[${params.departmentName}] New support ticket: ${params.subject}`;
  const html = `<h2>New support ticket</h2>
<p>A support ticket was opened for <strong>${department}</strong> at <strong>${tenant}</strong>.</p>
<p><strong>Subject:</strong> ${subject}</p>
${description ? `<p><strong>Details:</strong></p><p style="white-space:pre-wrap;">${description}</p>` : ""}
<p style="color:#64748b;font-size:14px;">Open the ticket in BrassHR: ${escapeHtml(linkPath)}</p>`;
  const text = `New support ticket for ${params.departmentName} at ${params.tenantName}.
Subject: ${params.subject}
${params.description?.trim() ? `\n${params.description.trim().slice(0, 2000)}\n` : ""}
Open: ${linkPath}`;

  const resend = new Resend(resendConfig.apiKey);
  const { error: sendError } = await resend.emails.send({
    from: resendConfig.fromHeader,
    to: params.email,
    subject: mailSubject,
    html,
    text,
    ...(resendConfig.replyTo ? { reply_to: resendConfig.replyTo } : {}),
  });

  if (sendError) {
    console.error("[department-ticket] Resend error", { name: sendError.name });
    const message = (sendError.message || "").toLowerCase();
    if (message.includes("rate") || message.includes("too many")) {
      return { ok: false, message: "Please wait before sending another email.", reason: "rate_limit" };
    }
    return {
      ok: false,
      message: sendError.message || "Could not send department ticket email.",
      reason: "send_failed",
    };
  }

  return { ok: true };
}
