import {
  buildFromEmailAddress,
  DEFAULT_FROM_EMAIL_LOCAL_PART,
} from "@/lib/email/from-address";

export class CommunicationConfigError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = "CommunicationConfigError";
  }
}

export function requireResendConfig(): { apiKey: string; fromHeader: string; replyTo: string | null } {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new CommunicationConfigError("RESEND_API_KEY is not configured");
  }

  const displayName = process.env.RESEND_FROM_DISPLAY_NAME?.trim() || "Nexus MedPro";
  const address = buildFromEmailAddress(DEFAULT_FROM_EMAIL_LOCAL_PART);
  const fromHeader = `${displayName} <${address}>`;
  const replyTo = process.env.DEFAULT_SUPPORT_EMAIL?.trim() || null;

  return { apiKey, fromHeader, replyTo };
}

export function requireTwilioConfig(): {
  accountSid: string;
  authToken: string;
  fromNumber: string | null;
  messagingServiceSid: string | null;
} {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!accountSid || !authToken) {
    throw new CommunicationConfigError(
      "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be configured"
    );
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() || null;
  const messagingServiceSid = process.env.TWILIO_SERVICE_SID?.trim() || null;

  if (!fromNumber && !messagingServiceSid) {
    throw new CommunicationConfigError(
      "Configure TWILIO_PHONE_NUMBER or TWILIO_SERVICE_SID for SMS sending"
    );
  }

  return { accountSid, authToken, fromNumber, messagingServiceSid };
}
