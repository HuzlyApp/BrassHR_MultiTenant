import type { SupabaseClient } from "@supabase/supabase-js";
import { attachWorkerProfilePhotoUrls } from "@/lib/applicant-portal/worker-profile-photo";
import {
  buildCommunicationThreads,
  type CommunicationThread,
} from "@/lib/communication/conversation";
import type { CandidateCommunicationRow } from "@/lib/communication/record";
import { resolveWorkerContact, type WorkerContact } from "@/lib/communication/resolve-worker";

const SELECT_WITH_WORKER =
  "id, worker_id, channel, recipient, subject, body, body_html, provider_message_id, status, direction, conversation_id, contact_email, from_email, to_email, in_reply_to, email_references, normalized_subject, error_message, created_at, sent_by_user_id";

export type TenantMailInboxItem = {
  workerId: string;
  candidateName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  profilePhotoUrl: string | null;
  thread: CommunicationThread;
};

function displayName(contact: WorkerContact): string {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  return name || "Applicant";
}

export async function listTenantMailInbox(
  supabase: SupabaseClient,
  tenantId: string,
  limit = 300
): Promise<TenantMailInboxItem[]> {
  const { data, error } = await supabase
    .from("candidate_communications")
    .select(SELECT_WITH_WORKER)
    .eq("tenant_id", tenantId)
    .eq("channel", "email")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[listTenantMailInbox] query failed:", error.message);
    return [];
  }

  const byWorker = new Map<string, CandidateCommunicationRow[]>();
  for (const raw of data ?? []) {
    const row = raw as CandidateCommunicationRow & { worker_id: string };
    const workerId = String(row.worker_id);
    const list = byWorker.get(workerId) ?? [];
    list.push(row);
    byWorker.set(workerId, list);
  }

  const items: TenantMailInboxItem[] = [];

  for (const [workerId, communications] of byWorker) {
    const contact = await resolveWorkerContact(supabase, workerId);
    if (!contact) continue;

    const threads = buildCommunicationThreads(communications, workerId, {
      email: contact.email,
      phone: contact.phone,
    });
    const emailThread = threads.find((thread) => thread.channel === "email");
    if (!emailThread) continue;

    items.push({
      workerId,
      candidateName: displayName(contact),
      contactEmail: contact.email,
      contactPhone: contact.phone,
      profilePhotoUrl: null,
      thread: emailThread,
    });
  }

  const sorted = items.sort(
    (a, b) => new Date(b.thread.latestAt).getTime() - new Date(a.thread.latestAt).getTime()
  );

  if (sorted.length === 0) return sorted;

  const withPhotos = await attachWorkerProfilePhotoUrls(
    supabase,
    sorted.map((item) => ({ id: item.workerId }))
  );
  const photoByWorkerId = new Map(
    withPhotos.map((row) => [String(row.id), (row.profile_photo_url as string | null) ?? null])
  );

  return sorted.map((item) => ({
    ...item,
    profilePhotoUrl: photoByWorkerId.get(item.workerId) ?? null,
  }));
}
