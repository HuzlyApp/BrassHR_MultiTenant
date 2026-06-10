// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { Resend } from "https://esm.sh/resend@6.12.4";

declare const Deno: { env: { get: (name: string) => string | undefined } };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};

const LEGACY_DOMAIN = "nexusmedpro.com";
const CURRENT_DOMAIN = "brasshr.com";
const COMPANY_EMAIL = "notifications@brasshr.com";

async function stableConversationId(workerId: string, channel: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`brasshr:conversation:${workerId}:${channel}`)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function normalizeSubject(subject: string | null): string | null {
  if (!subject?.trim()) return null;
  let s = subject.trim();
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/^(re|fwd|fw):\s*/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s.toLowerCase();
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function extractBareEmail(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angle?.[1]) return angle[1].trim().toLowerCase();
  return trimmed.toLowerCase();
}

function emailLookupVariants(email: string): string[] {
  const bare = extractBareEmail(email);
  const seen = new Set<string>();
  const add = (v: string) => {
    if (v && !seen.has(v)) seen.add(v);
  };
  add(bare);
  if (bare.endsWith(`@${LEGACY_DOMAIN}`)) {
    add(bare.replace(`@${LEGACY_DOMAIN}`, `@${CURRENT_DOMAIN}`));
  }
  if (bare.endsWith(`@${CURRENT_DOMAIN}`)) {
    add(bare.replace(`@${CURRENT_DOMAIN}`, `@${LEGACY_DOMAIN}`));
  }
  return Array.from(seen);
}

function extractInboundBody(
  email: { text?: string | null; html?: string | null; subject?: string },
  webhookSubject?: string | null
): string {
  const text = typeof email.text === "string" ? email.text.trim() : "";
  if (text) return text;
  const html = typeof email.html === "string" ? email.html.trim() : "";
  if (html) return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const subject = (email.subject || webhookSubject || "").trim();
  if (subject) return `(No message body — subject: ${subject})`;
  return "(Empty inbound email)";
}

async function resolveWorkerByEmail(
  supabase: ReturnType<typeof createClient>,
  rawEmail: string
): Promise<{ id: string; tenant_id: string } | null> {
  const variants = emailLookupVariants(rawEmail);
  if (variants.length === 0) return null;

  const { data: worker } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .in("email", variants)
    .not("tenant_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (worker?.id && worker.tenant_id) {
    return { id: String(worker.id), tenant_id: String(worker.tenant_id) };
  }

  const { data: users } = await supabase.from("users").select("id").in("email", variants).limit(5);
  const userIds = (users ?? []).map((u) => String((u as { id: string }).id)).filter(Boolean);
  if (userIds.length === 0) return null;

  const { data: linked } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .in("user_id", userIds)
    .not("tenant_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!linked?.id || !linked.tenant_id) return null;
  return { id: String(linked.id), tenant_id: String(linked.tenant_id) };
}

function parseWebhookEvent(req: Request, rawBody: string, resend: Resend): { type: string; data?: Record<string, unknown> } | null {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim();
  if (!secret) {
    console.warn("[resend-inbound] RESEND_WEBHOOK_SECRET missing");
    return null;
  }
  try {
    return resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    }) as { type: string; data?: Record<string, unknown> };
  } catch (e) {
    console.warn("[resend-inbound] verification failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      ok: true,
      route: "/functions/v1/resend-inbound",
      webhookSecretConfigured: Boolean(Deno.env.get("RESEND_WEBHOOK_SECRET")?.trim()),
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server not configured" }, 503);
  }

  const rawBody = await req.text();
  const resend = new Resend(apiKey);
  const event = parseWebhookEvent(req, rawBody, resend);
  if (!event) {
    return json({ error: "Invalid webhook" }, 403);
  }

  console.info("[resend-inbound] event", { type: event.type });

  if (event.type !== "email.received") {
    return json({ ok: true, ignored: true, type: event.type });
  }

  const data = event.data ?? {};
  const emailId = String(data.email_id ?? "").trim();
  const from = String(data.from ?? "").trim();
  const subject = String(data.subject ?? "").trim() || null;

  if (!emailId || !from) {
    return json({ error: "Missing email metadata" }, 400);
  }

  const { data: emailContent, error: contentError } = await resend.emails.receiving.get(emailId);
  if (contentError || !emailContent) {
    console.warn("[resend-inbound] body fetch failed", contentError?.message);
    return json({ error: "Email body unavailable", detail: contentError?.message }, 502);
  }

  const body = extractInboundBody(emailContent, subject);
  const sender = extractBareEmail(from);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: existing } = await supabase
    .from("candidate_communications")
    .select("id, worker_id")
    .eq("provider_message_id", emailId)
    .maybeSingle();

  if (existing?.worker_id) {
    return json({ ok: true, recorded: true, duplicate: true, workerId: existing.worker_id });
  }

  const worker = await resolveWorkerByEmail(supabase, sender);
  if (!worker) {
    console.info("[resend-inbound] unmatched sender", { from: sender, subject, emailId });
    return json({ ok: true, recorded: false, reason: "contact_not_found" });
  }

  const conversationId = await stableConversationId(String(worker.id), "email");
  const companyEmail = Deno.env.get("RESEND_FROM_DOMAIN")
    ? `notifications@${Deno.env.get("RESEND_FROM_DOMAIN")!.trim().toLowerCase()}`
    : COMPANY_EMAIL;

  const { data: row, error: insertError } = await supabase
    .from("candidate_communications")
    .insert({
      tenant_id: worker.tenant_id,
      worker_id: worker.id,
      sent_by_user_id: null,
      channel: "email",
      recipient: sender,
      subject: subject || "Inbound email",
      body,
      body_html: emailContent?.html ?? null,
      provider_message_id: emailId,
      status: "received",
      direction: "inbound",
      conversation_id: conversationId,
      contact_email: sender,
      from_email: sender,
      to_email: companyEmail,
      normalized_subject: normalizeSubject(subject),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[resend-inbound] insert failed", insertError.message);
    return json({ ok: false, error: insertError.message }, 500);
  }

  console.info("[resend-inbound] recorded", { communicationId: row?.id, workerId: worker.id, from: sender });

  return json({ ok: true, recorded: true, workerId: worker.id, communicationId: row?.id });
});
