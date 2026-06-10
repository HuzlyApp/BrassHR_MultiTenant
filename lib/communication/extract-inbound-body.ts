import type { GetReceivingEmailResponseSuccess } from "resend";

/** Extract readable body from Resend receiving API response; never returns empty if subject exists. */
export function extractInboundEmailBody(
  email: Pick<GetReceivingEmailResponseSuccess, "text" | "html" | "subject">,
  webhookSubject?: string | null
): string {
  const text = typeof email.text === "string" ? email.text.trim() : "";
  if (text) return text;

  const html = typeof email.html === "string" ? email.html.trim() : "";
  if (html) {
    return html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const subject = (email.subject || webhookSubject || "").trim();
  if (subject) return `(No message body — subject: ${subject})`;

  return "(Empty inbound email)";
}
