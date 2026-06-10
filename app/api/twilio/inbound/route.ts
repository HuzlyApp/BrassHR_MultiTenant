import { NextResponse } from "next/server";
import twilio from "twilio";
import { recordCandidateCommunication } from "@/lib/communication/record";
import { normalizePhoneToE164 } from "@/lib/communication/phone";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

type TwilioInboundParams = {
  MessageSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  NumMedia?: string;
};

function twimlResponse(status = 200) {
  return new Response("<Response></Response>", {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function requestUrl(req: Request): string {
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto) url.protocol = `${forwardedProto}:`;
  if (forwardedHost) url.host = forwardedHost;
  return url.toString();
}

function paramsObject(form: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });
  return params;
}

function isValidTwilioRequest(req: Request, params: Record<string, string>): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    const allowUnsigned =
      process.env.NODE_ENV !== "production" && process.env.TWILIO_ALLOW_UNSIGNED_WEBHOOKS === "true";
    if (allowUnsigned) {
      console.warn("[twilio/inbound] unsigned webhook allowed by local override");
      return true;
    }
    console.warn("[twilio/inbound] TWILIO_AUTH_TOKEN missing; rejecting webhook");
    return false;
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;

  return twilio.validateRequest(authToken, signature, requestUrl(req), params);
}

async function recordInboundMessage(params: TwilioInboundParams) {
  const from = normalizePhoneToE164(params.From ?? "") ?? params.From?.trim();
  const to = normalizePhoneToE164(params.To ?? "") ?? params.To?.trim() ?? null;
  const body = params.Body?.trim() || "";
  if (!from || !body) return;

  const supabase = createServiceRoleClient();
  if (!supabase) return;

  const phoneCandidates = Array.from(
    new Set([from, params.From?.trim()].filter((value): value is string => Boolean(value)))
  );

  const { data: worker } = await supabase
    .from("worker")
    .select("id, tenant_id, phone")
    .in("phone", phoneCandidates)
    .not("tenant_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!worker?.id || !worker.tenant_id) {
    console.info("[twilio/inbound] received unmatched message", {
      messageSid: params.MessageSid ?? null,
      from,
      to,
      numMedia: params.NumMedia ?? "0",
    });
    return;
  }

  await recordCandidateCommunication(supabase, {
    tenantId: String(worker.tenant_id),
    workerId: String(worker.id),
    sentByUserId: null,
    channel: "sms",
    recipient: from,
    subject: "Inbound SMS",
    body,
    providerMessageId: params.MessageSid ?? null,
    status: "received",
    direction: "inbound",
  });
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, {
    namespace: "twilio-inbound",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_WEBHOOKS_PER_MINUTE ?? 120),
    windowMs: 60 * 1000,
    failClosed: false,
  });
  if (limited) return limited;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return twimlResponse(400);
  }

  const allParams = paramsObject(form);
  if (!isValidTwilioRequest(req, allParams)) {
    console.warn("[twilio/inbound] invalid Twilio signature");
    return twimlResponse(403);
  }

  await recordInboundMessage(allParams);
  return twimlResponse();
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/twilio/inbound" });
}
