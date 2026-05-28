import { Resend } from "resend";
import { requireResendConfig } from "@/lib/communication/env";
import {
  plainTextToHtml,
  sanitizeEmailBody,
  sanitizeEmailSubject,
} from "@/lib/communication/sanitize";

export type SendCandidateEmailInput = {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
};

export type SendCandidateEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

export async function sendCandidateEmail(
  input: SendCandidateEmailInput
): Promise<SendCandidateEmailResult> {
  let config: ReturnType<typeof requireResendConfig>;
  try {
    config = requireResendConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email is not configured";
    return { ok: false, error: msg };
  }

  const subject = sanitizeEmailSubject(input.subject);
  const bodyText = sanitizeEmailBody(input.body);
  if (!subject) return { ok: false, error: "Subject is required" };
  if (!bodyText) return { ok: false, error: "Message body is required" };

  const html =
    input.bodyHtml?.trim() && input.bodyHtml.trim().length > 0
      ? sanitizeEmailBody(input.bodyHtml)
      : plainTextToHtml(bodyText);

  const resend = new Resend(config.apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: config.fromHeader,
      to: input.to.trim(),
      subject,
      html,
      text: bodyText,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    });

    if (error) {
      console.error("[communication/email] Resend error", { name: error.name });
      return { ok: false, error: error.message || "Failed to send email" };
    }

    return { ok: true, messageId: data?.id ?? null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send email";
    console.error("[communication/email]", msg);
    return { ok: false, error: msg };
  }
}
