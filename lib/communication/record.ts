import type { SupabaseClient } from "@supabase/supabase-js";

export type CommunicationChannel = "email" | "sms";
export type CommunicationStatus = "sent" | "failed";

export type RecordCommunicationInput = {
  tenantId: string;
  workerId: string;
  sentByUserId: string | null;
  channel: CommunicationChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  providerMessageId?: string | null;
  status: CommunicationStatus;
  errorMessage?: string | null;
};

export type CandidateCommunicationRow = {
  id: string;
  channel: CommunicationChannel;
  recipient: string;
  subject: string | null;
  body: string;
  provider_message_id: string | null;
  status: CommunicationStatus;
  error_message: string | null;
  created_at: string;
  sent_by_user_id: string | null;
};

export async function recordCandidateCommunication(
  supabase: SupabaseClient,
  input: RecordCommunicationInput
): Promise<CandidateCommunicationRow | null> {
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
      provider_message_id: input.providerMessageId ?? null,
      status: input.status,
      error_message: input.errorMessage ?? null,
    })
    .select(
      "id, channel, recipient, subject, body, provider_message_id, status, error_message, created_at, sent_by_user_id"
    )
    .single();

  if (error) {
    console.error("[candidate_communications] insert failed:", error.message);
    return null;
  }

  return data as CandidateCommunicationRow;
}

export async function listCandidateCommunications(
  supabase: SupabaseClient,
  workerId: string,
  limit = 50
): Promise<CandidateCommunicationRow[]> {
  const { data, error } = await supabase
    .from("candidate_communications")
    .select(
      "id, channel, recipient, subject, body, provider_message_id, status, error_message, created_at, sent_by_user_id"
    )
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[candidate_communications] list failed:", error.message);
    return [];
  }

  return (data ?? []) as CandidateCommunicationRow[];
}
