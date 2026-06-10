import type { SupabaseClient } from "@supabase/supabase-js";
import { extractBareEmailAddress } from "@/lib/email/email-domain";
import {
  buildCommunicationThreads,
  buildConversationId,
  getCompanyNotificationEmail,
  normalizeEmailSubject,
  type CommunicationThread,
} from "@/lib/communication/conversation";
import { invalidateResourceCache, invalidateTenantCache } from "@/lib/cache";

export type CommunicationChannel = "email" | "sms";
export type CommunicationStatus = "sent" | "failed" | "received";
export type CommunicationDirection = "inbound" | "outbound";

export type RecordCommunicationInput = {
  tenantId: string;
  workerId: string;
  sentByUserId: string | null;
  channel: CommunicationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  bodyHtml?: string | null;
  fromEmail?: string | null;
  toEmail?: string | null;
  contactEmail?: string | null;
  providerMessageId?: string | null;
  inReplyTo?: string | null;
  emailReferences?: string | null;
  status: CommunicationStatus;
  direction: CommunicationDirection;
  errorMessage?: string | null;
};

export type CandidateCommunicationRow = {
  id: string;
  channel: CommunicationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  body_html: string | null;
  provider_message_id: string | null;
  status: CommunicationStatus;
  direction: CommunicationDirection | null;
  conversation_id: string | null;
  contact_email: string | null;
  from_email: string | null;
  to_email: string | null;
  in_reply_to: string | null;
  email_references: string | null;
  normalized_subject: string | null;
  error_message: string | null;
  created_at: string;
  sent_by_user_id: string | null;
};

export type CandidateCommunicationsPayload = {
  communications: CandidateCommunicationRow[];
  threads: CommunicationThread[];
};

const SELECT_COLUMNS =
  "id, channel, recipient, subject, body, body_html, provider_message_id, status, direction, conversation_id, contact_email, from_email, to_email, in_reply_to, email_references, normalized_subject, error_message, created_at, sent_by_user_id";

function resolveEmailAddresses(input: RecordCommunicationInput): {
  contactEmail: string;
  fromEmail: string;
  toEmail: string;
} {
  const company = getCompanyNotificationEmail();
  const contact = extractBareEmailAddress(
    input.contactEmail ?? input.recipient
  );

  if (input.direction === "inbound") {
    return {
      contactEmail: contact,
      fromEmail: input.fromEmail?.trim().toLowerCase() || contact,
      toEmail: input.toEmail?.trim().toLowerCase() || company,
    };
  }

  return {
    contactEmail: contact,
    fromEmail: input.fromEmail?.trim().toLowerCase() || company,
    toEmail: input.toEmail?.trim().toLowerCase() || contact,
  };
}

export async function findCommunicationByProviderMessageId(
  supabase: SupabaseClient,
  providerMessageId: string
): Promise<{ id: string; worker_id: string } | null> {
  const { data, error } = await supabase
    .from("candidate_communications")
    .select("id, worker_id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) {
    console.error("[candidate_communications] provider lookup failed:", error.message);
    return null;
  }

  return data as { id: string; worker_id: string } | null;
}

export async function recordCandidateCommunication(
  supabase: SupabaseClient,
  input: RecordCommunicationInput
): Promise<CandidateCommunicationRow | null> {
  const conversationId = buildConversationId(input.workerId, input.channel);
  const normalizedSubject =
    input.channel === "email" ? normalizeEmailSubject(input.subject) : null;

  const emailAddresses =
    input.channel === "email" ? resolveEmailAddresses(input) : null;

  const { data, error } = await supabase
    .from("candidate_communications")
    .insert({
      tenant_id: input.tenantId,
      worker_id: input.workerId,
      sent_by_user_id: input.sentByUserId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject ?? null,
      body: input.body,
      body_html: input.bodyHtml ?? null,
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      direction: input.direction,
      conversation_id: conversationId,
      contact_email: emailAddresses?.contactEmail ?? null,
      from_email: emailAddresses?.fromEmail ?? null,
      to_email: emailAddresses?.toEmail ?? null,
      in_reply_to: input.inReplyTo ?? null,
      email_references: input.emailReferences ?? null,
      normalized_subject: normalizedSubject || null,
      error_message: input.errorMessage ?? null,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    console.error("[candidate_communications] insert failed:", error.message);
    return null;
  }

  await Promise.all([
    invalidateResourceCache("candidate_communications", input.workerId),
    invalidateTenantCache("candidate_communications", input.tenantId),
  ]);

  return data as CandidateCommunicationRow;
}

export async function listCandidateCommunications(
  supabase: SupabaseClient,
  workerId: string,
  limit = 100
): Promise<CandidateCommunicationRow[]> {
  return listCandidateCommunicationsUncached(supabase, workerId, limit);
}

export async function listCandidateCommunicationsWithThreads(
  supabase: SupabaseClient,
  workerId: string,
  contact: { email?: string | null; phone?: string | null },
  limit = 100
): Promise<CandidateCommunicationsPayload> {
  const communications = await listCandidateCommunicationsUncached(supabase, workerId, limit);
  const threads = buildCommunicationThreads(communications, workerId, contact);
  return { communications, threads };
}

async function listCandidateCommunicationsUncached(
  supabase: SupabaseClient,
  workerId: string,
  limit = 100
): Promise<CandidateCommunicationRow[]> {
  const { data, error } = await supabase
    .from("candidate_communications")
    .select(SELECT_COLUMNS)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[candidate_communications] list failed:", error.message);
    return [];
  }

  return (data ?? []) as CandidateCommunicationRow[];
}
