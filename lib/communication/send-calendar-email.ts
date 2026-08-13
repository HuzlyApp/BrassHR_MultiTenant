import { Resend } from "resend";
import { requireResendConfig } from "@/lib/communication/env";
import {
  plainTextToHtml,
  sanitizeEmailBody,
  sanitizeEmailSubject,
} from "@/lib/communication/sanitize";

export type CalendarEmailAttachment = {
  filename: string;
  content: string;
  method: "REQUEST" | "CANCEL";
};

export type SendCalendarEmailInput = {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  calendarAttachment: CalendarEmailAttachment;
};

export type SendCalendarEmailResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

export async function sendCalendarEmail(
  input: SendCalendarEmailInput
): Promise<SendCalendarEmailResult> {
  let config: ReturnType<typeof requireResendConfig>;
  try {
    config = requireResendConfig();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Email is not configured";
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
      attachments: [
        {
          filename: input.calendarAttachment.filename,
          content: Buffer.from(input.calendarAttachment.content, "utf8").toString("base64"),
          contentType: `text/calendar; method=${input.calendarAttachment.method}; charset=UTF-8`,
        },
      ],
      headers: {
        "Content-Class": "urn:content-classes:calendarmessage",
      },
    });

    if (error) {
      console.error("[communication/calendar-email] Resend error", { name: error.name });
      return { ok: false, error: error.message || "Failed to send email" };
    }

    return { ok: true, messageId: data?.id ?? null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email";
    console.error("[communication/calendar-email]", msg);
    return { ok: false, error: msg };
  }
}
