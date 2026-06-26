import type { SupabaseClient } from "@supabase/supabase-js";
import { attachWorkerProfilePhotoUrls } from "@/lib/applicant-portal/worker-profile-photo";
import { resolveWorkerContact } from "@/lib/communication/resolve-worker";

export type MailDraftRow = {
  id: string;
  tenant_id: string;
  author_user_id: string;
  worker_id: string;
  subject: string;
  body: string;
  body_html: string | null;
  template_key: string | null;
  created_at: string;
  updated_at: string;
};

export type MailDraftListItem = {
  id: string;
  workerId: string;
  candidateName: string;
  contactEmail: string | null;
  profilePhotoUrl: string | null;
  subject: string;
  body: string;
  bodyHtml: string | null;
  templateKey: string | null;
  updatedAt: string;
};

export type UpsertMailDraftInput = {
  tenantId: string;
  authorUserId: string;
  workerId: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  templateKey?: string | null;
};

function displayName(first: string | null, last: string | null): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || "Applicant";
}

function hasDraftContent(input: Pick<UpsertMailDraftInput, "subject" | "body">): boolean {
  return Boolean(input.subject.trim() || input.body.trim());
}

export async function listMailDrafts(
  supabase: SupabaseClient,
  tenantId: string,
  authorUserId: string
): Promise<MailDraftListItem[]> {
  const { data, error } = await supabase
    .from("mail_drafts")
    .select(
      "id, tenant_id, author_user_id, worker_id, subject, body, body_html, template_key, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("author_user_id", authorUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[listMailDrafts] query failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as MailDraftRow[];
  if (rows.length === 0) return [];

  const workerIds = [...new Set(rows.map((row) => row.worker_id))];
  const { data: workers } = await supabase
    .from("worker")
    .select("id, first_name, last_name")
    .in("id", workerIds);

  const workerById = new Map(
    ((workers as Array<{ id: string; first_name?: string | null; last_name?: string | null }> | null) ??
      []
    ).map((worker) => [String(worker.id), worker])
  );

  const withPhotos = await attachWorkerProfilePhotoUrls(
    supabase,
    workerIds.map((id) => {
      const worker = workerById.get(id);
      return {
        id,
        first_name: worker?.first_name ?? null,
        last_name: worker?.last_name ?? null,
      };
    })
  );
  const photoByWorkerId = new Map(
    withPhotos.map((row) => [String(row.id), (row.profile_photo_url as string | null) ?? null])
  );

  const items: MailDraftListItem[] = [];
  for (const row of rows) {
    const contact = await resolveWorkerContact(supabase, row.worker_id);
    const worker = workerById.get(row.worker_id);
    items.push({
      id: row.id,
      workerId: row.worker_id,
      candidateName: contact
        ? displayName(contact.firstName, contact.lastName)
        : worker
          ? displayName(worker.first_name ?? null, worker.last_name ?? null)
          : "Applicant",
      contactEmail: contact?.email ?? null,
      profilePhotoUrl: photoByWorkerId.get(row.worker_id) ?? null,
      subject: row.subject,
      body: row.body,
      bodyHtml: row.body_html,
      templateKey: row.template_key,
      updatedAt: row.updated_at,
    });
  }

  return items;
}

export async function getMailDraftForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  authorUserId: string,
  workerId: string
): Promise<MailDraftRow | null> {
  const { data, error } = await supabase
    .from("mail_drafts")
    .select(
      "id, tenant_id, author_user_id, worker_id, subject, body, body_html, template_key, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .eq("author_user_id", authorUserId)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (error) {
    console.error("[getMailDraftForWorker] query failed:", error.message);
    return null;
  }
  return (data as MailDraftRow | null) ?? null;
}

export async function upsertMailDraft(
  supabase: SupabaseClient,
  input: UpsertMailDraftInput
): Promise<MailDraftRow | null> {
  if (!hasDraftContent(input)) {
    await deleteMailDraftForWorker(
      supabase,
      input.tenantId,
      input.authorUserId,
      input.workerId
    );
    return null;
  }

  const now = new Date().toISOString();
  const payload = {
    tenant_id: input.tenantId,
    author_user_id: input.authorUserId,
    worker_id: input.workerId,
    subject: input.subject.trim(),
    body: input.body.trim(),
    body_html: input.bodyHtml?.trim() || null,
    template_key: input.templateKey?.trim() || null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("mail_drafts")
    .upsert(payload, { onConflict: "author_user_id,worker_id" })
    .select(
      "id, tenant_id, author_user_id, worker_id, subject, body, body_html, template_key, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("[upsertMailDraft] failed:", error.message);
    throw new Error(error.message);
  }

  return data as MailDraftRow;
}

export async function deleteMailDraftForWorker(
  supabase: SupabaseClient,
  tenantId: string,
  authorUserId: string,
  workerId: string
): Promise<void> {
  const { error } = await supabase
    .from("mail_drafts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("author_user_id", authorUserId)
    .eq("worker_id", workerId);

  if (error) {
    console.error("[deleteMailDraftForWorker] failed:", error.message);
    throw new Error(error.message);
  }
}

export async function deleteMailDraftById(
  supabase: SupabaseClient,
  tenantId: string,
  authorUserId: string,
  draftId: string
): Promise<void> {
  const { error } = await supabase
    .from("mail_drafts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("author_user_id", authorUserId)
    .eq("id", draftId);

  if (error) {
    console.error("[deleteMailDraftById] failed:", error.message);
    throw new Error(error.message);
  }
}
