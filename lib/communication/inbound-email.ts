import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompanyNotificationEmail } from "@/lib/communication/conversation";
import { extractBareEmailAddress } from "@/lib/email/email-domain";
import {
  findCommunicationByProviderMessageId,
  recordCandidateCommunication,
} from "@/lib/communication/record";
import { resolveWorkerByEmail } from "@/lib/communication/resolve-worker-by-email";

export type InboundEmailPayload = {
  from: string;
  to?: string | null;
  subject?: string | null;
  body: string;
  bodyHtml?: string | null;
  providerMessageId?: string | null;
  inReplyTo?: string | null;
  emailReferences?: string | null;
};

export async function recordInboundCandidateEmail(
  supabase: SupabaseClient,
  payload: InboundEmailPayload
): Promise<{ recorded: boolean; workerId?: string; duplicate?: boolean; reason?: string }> {
  const from = extractBareEmailAddress(payload.from);
  const body = payload.body.trim();
  const providerMessageId = payload.providerMessageId?.trim() || null;

  if (!from) {
    console.warn("[resend/inbound] missing sender address", { providerMessageId });
    return { recorded: false, reason: "missing_from" };
  }

  if (!body) {
    console.warn("[resend/inbound] empty body after extraction", { from, providerMessageId });
    return { recorded: false, reason: "empty_body" };
  }

  if (providerMessageId) {
    const existing = await findCommunicationByProviderMessageId(supabase, providerMessageId);
    if (existing) {
      console.info("[resend/inbound] duplicate provider message skipped", {
        providerMessageId,
        workerId: existing.worker_id,
      });
      return { recorded: true, workerId: existing.worker_id, duplicate: true };
    }
  }

  const worker = await resolveWorkerByEmail(supabase, from);
  if (!worker?.id || !worker.tenant_id) {
    console.info("[resend/inbound] received unmatched email", {
      from,
      subject: payload.subject ?? null,
      providerMessageId,
    });
    return { recorded: false, reason: "contact_not_found" };
  }

  const row = await recordCandidateCommunication(supabase, {
    tenantId: String(worker.tenant_id),
    workerId: String(worker.id),
    sentByUserId: null,
    channel: "email",
    recipient: from,
    contactEmail: from,
    fromEmail: from,
    toEmail: extractBareEmailAddress(payload.to ?? getCompanyNotificationEmail()),
    subject: payload.subject?.trim() || "Inbound email",
    body,
    bodyHtml: payload.bodyHtml ?? null,
    providerMessageId,
    inReplyTo: payload.inReplyTo ?? null,
    emailReferences: payload.emailReferences ?? null,
    status: "received",
    direction: "inbound",
  });

  if (!row) {
    console.error("[resend/inbound] insert failed", { from, workerId: worker.id, providerMessageId });
    return { recorded: false, reason: "insert_failed" };
  }

  console.info("[resend/inbound] recorded inbound email", {
    communicationId: row.id,
    workerId: worker.id,
    from,
    subject: payload.subject ?? null,
    providerMessageId,
  });

  return { recorded: true, workerId: String(worker.id) };
}
