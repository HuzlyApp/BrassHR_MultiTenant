import { NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";
import { extractInboundEmailBody } from "@/lib/communication/extract-inbound-body";
import { recordInboundCandidateEmail } from "@/lib/communication/inbound-email";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function parseWebhookEvent(req: Request, rawBody: string): EmailReceivedEvent | null {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    const allowUnsigned =
      process.env.NODE_ENV !== "production" && process.env.RESEND_ALLOW_UNSIGNED_WEBHOOKS === "true";
    if (allowUnsigned) {
      try {
        return JSON.parse(rawBody) as EmailReceivedEvent;
      } catch {
        return null;
      }
    }
    console.warn("[resend/inbound] RESEND_WEBHOOK_SECRET missing; rejecting webhook");
    return null;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[resend/inbound] RESEND_API_KEY missing; rejecting webhook");
    return null;
  }

  const resend = new Resend(apiKey);
  try {
    const verified = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
    return verified as EmailReceivedEvent;
  } catch (e) {
    console.warn("[resend/inbound] webhook verification failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    namespace: "resend-inbound",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_WEBHOOKS_PER_MINUTE ?? 120),
    windowMs: 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  const rawBody = await req.text();
  const event = parseWebhookEvent(req, rawBody);
  if (!event) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 403 });
  }

  console.info("[resend/inbound] webhook received", {
    type: event.type,
    emailId: event.type === "email.received" ? event.data.email_id : null,
  });

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true, type: event.type });
  }

  const emailId = event.data.email_id?.trim();
  const from = event.data.from?.trim();
  const subject = event.data.subject?.trim() || null;

  if (!emailId || !from) {
    console.warn("[resend/inbound] missing metadata", { emailId, from });
    return NextResponse.json({ error: "Missing email metadata" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const { data: emailContent, error: contentError } = await resend.emails.receiving.get(emailId);
  if (contentError || !emailContent) {
    console.warn("[resend/inbound] could not fetch email body", {
      emailId,
      error: contentError?.message,
    });
    return NextResponse.json(
      { error: "Email body unavailable", detail: contentError?.message },
      { status: 502 }
    );
  }

  const body = extractInboundEmailBody(emailContent, subject);
  console.info("[resend/inbound] parsed inbound email", {
    emailId,
    from,
    to: event.data.to,
    subject,
    bodyLength: body.length,
    messageId: event.data.message_id,
  });

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const result = await recordInboundCandidateEmail(supabase, {
    from,
    to: event.data.to?.[0] ?? null,
    subject,
    body,
    bodyHtml: emailContent.html ?? null,
    providerMessageId: emailId,
    inReplyTo: emailContent.headers?.["in-reply-to"] ?? emailContent.headers?.["In-Reply-To"] ?? null,
    emailReferences: emailContent.headers?.references ?? emailContent.headers?.References ?? null,
  });

  if (!result.recorded && result.reason === "insert_failed") {
    return NextResponse.json({ ok: false, ...result }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/resend/inbound",
    webhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
  });
}
