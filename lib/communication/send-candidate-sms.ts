import twilio from "twilio";
import { requireTwilioConfig } from "@/lib/communication/env";
import { isValidE164, normalizePhoneToE164 } from "@/lib/communication/phone";
import { sanitizeSmsBody } from "@/lib/communication/sanitize";

export type SendCandidateSmsInput = {
  to: string;
  body: string;
};

export type SendCandidateSmsResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string };

export async function sendCandidateSms(input: SendCandidateSmsInput): Promise<SendCandidateSmsResult> {
  let config: ReturnType<typeof requireTwilioConfig>;
  try {
    config = requireTwilioConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS is not configured";
    return { ok: false, error: msg };
  }

  const to = normalizePhoneToE164(input.to);
  if (!to || !isValidE164(to)) {
    return { ok: false, error: "Invalid phone number. Use a valid mobile number with country code." };
  }

  const body = sanitizeSmsBody(input.body);
  if (!body) return { ok: false, error: "Message body is required" };

  const client = twilio(config.accountSid, config.authToken);

  try {
    const message = await client.messages.create({
      to,
      body,
      ...(config.messagingServiceSid
        ? { messagingServiceSid: config.messagingServiceSid }
        : { from: config.fromNumber! }),
    });

    return { ok: true, messageId: message.sid ?? null };
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message?: string }).message)
        : "Failed to send SMS";
    console.error("[communication/sms] Twilio error", msg);
    return { ok: false, error: msg };
  }
}
