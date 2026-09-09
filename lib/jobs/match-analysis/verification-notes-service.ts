import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapVerificationNoteAuditRow,
  mapVerificationNoteRow,
  verificationNoteSnapshot,
  type CreateVerificationNoteInput,
  type UpdateVerificationNoteInput,
  type VerificationNote,
  type VerificationNoteAuditAction,
  type VerificationNoteAuditEvent,
} from "./verification-notes";

const NOTE_SELECT =
  "id, tenant_id, job_application_id, requirement_id, worker_id, job_requisition_id, analysis_version, note_body, candidate_question, due_date, verification_status, candidate_response, candidate_responded_at, created_by, updated_by, created_at, updated_at, deleted_at";

function displayName(
  first: string | null | undefined,
  last: string | null | undefined,
  email?: string | null
) {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name || email?.trim() || null;
}

async function loadUsersById(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: Array<string | null | undefined>
): Promise<Map<string, { name: string }>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  const usersById = new Map<string, { name: string }>();
  if (!ids.length) return usersById;
  const { data: users } = await supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  for (const user of users ?? []) {
    usersById.set(String(user.id), {
      name: displayName(user.first_name, user.last_name, user.email) || "Team member",
    });
  }
  return usersById;
}

export async function loadVerificationNotesForApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  requirementId?: string
): Promise<VerificationNote[]> {
  let query = supabase
    .from("job_application_match_requirement_notes")
    .select(NOTE_SELECT)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (requirementId) {
    query = query.eq("requirement_id", requirementId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const usersById = await loadUsersById(supabase, tenantId, [
    ...(data ?? []).map((row) => row.created_by),
    ...(data ?? []).map((row) => row.updated_by),
  ]);

  return (data ?? []).map((row) => mapVerificationNoteRow(row, usersById));
}

export async function loadVerificationNoteAuditForApplication(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  options?: { requirementId?: string; noteId?: string; limit?: number }
): Promise<VerificationNoteAuditEvent[]> {
  let query = supabase
    .from("job_application_match_requirement_note_audit")
    .select(
      "id, note_id, requirement_id, job_application_id, action, actor_user_id, before_state, after_state, created_at"
    )
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 200);

  if (options?.requirementId) query = query.eq("requirement_id", options.requirementId);
  if (options?.noteId) query = query.eq("note_id", options.noteId);

  const { data, error } = await query;
  if (error) throw error;

  const usersById = await loadUsersById(
    supabase,
    tenantId,
    (data ?? []).map((row) => row.actor_user_id)
  );
  return (data ?? []).map((row) => mapVerificationNoteAuditRow(row, usersById));
}

async function writeNoteAudit(args: {
  supabase: SupabaseClient;
  tenantId: string;
  noteId: string;
  jobApplicationId: string;
  requirementId: string;
  action: VerificationNoteAuditAction;
  actorUserId: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
}) {
  const { error } = await args.supabase.from("job_application_match_requirement_note_audit").insert({
    tenant_id: args.tenantId,
    note_id: args.noteId,
    job_application_id: args.jobApplicationId,
    requirement_id: args.requirementId,
    action: args.action,
    actor_user_id: args.actorUserId,
    before_state: args.beforeState ?? null,
    after_state: args.afterState ?? null,
  });
  if (error) throw error;
}

export async function createVerificationNote(args: {
  supabase: SupabaseClient;
  tenantId: string;
  applicationId: string;
  requirementId: string;
  actorUserId: string | null;
  input: CreateVerificationNoteInput;
}): Promise<VerificationNote> {
  const { supabase, tenantId, applicationId, requirementId, actorUserId, input } = args;

  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select("id, worker_id, job_requisition_id, ai_analysis_version")
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (appError) throw appError;
  if (!application) throw new Error("Application not found");

  const { data: requirement, error: reqError } = await supabase
    .from("job_application_match_requirements")
    .select("id, job_application_id")
    .eq("id", requirementId)
    .eq("job_application_id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reqError) throw reqError;
  if (!requirement) throw new Error("Requirement not found");

  const { data: existingNote, error: existingNoteError } = await supabase
    .from("job_application_match_requirement_notes")
    .select(NOTE_SELECT)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingNoteError) throw existingNoteError;
  if (existingNote) {
    return updateVerificationNote({
      supabase,
      tenantId,
      applicationId,
      requirementId,
      noteId: String(existingNote.id),
      actorUserId,
      input: {
        noteBody: input.noteBody,
        candidateQuestion: input.candidateQuestion,
        dueDate: input.dueDate,
        verificationStatus: input.verificationStatus,
        candidateResponse: input.candidateResponse,
      },
    });
  }

  const status = input.verificationStatus ?? "pending";
  const candidateResponse = input.candidateResponse?.trim() || null;
  const respondedAt =
    status === "candidate_responded" || candidateResponse
      ? new Date().toISOString()
      : null;

  const { data: inserted, error } = await supabase
    .from("job_application_match_requirement_notes")
    .insert({
      tenant_id: tenantId,
      job_application_id: applicationId,
      requirement_id: requirementId,
      worker_id: application.worker_id ?? null,
      job_requisition_id: application.job_requisition_id ?? null,
      analysis_version:
        application.ai_analysis_version == null
          ? null
          : Number(application.ai_analysis_version),
      note_body: input.noteBody.trim(),
      candidate_question: input.candidateQuestion?.trim() || null,
      due_date: input.dueDate ?? null,
      verification_status: status,
      candidate_response: candidateResponse,
      candidate_responded_at: respondedAt,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select(NOTE_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced, error: racedError } = await supabase
        .from("job_application_match_requirement_notes")
        .select(NOTE_SELECT)
        .eq("tenant_id", tenantId)
        .eq("job_application_id", applicationId)
        .eq("requirement_id", requirementId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (racedError) throw racedError;
      if (raced) {
        return updateVerificationNote({
          supabase,
          tenantId,
          applicationId,
          requirementId,
          noteId: String(raced.id),
          actorUserId,
          input: {
            noteBody: input.noteBody,
            candidateQuestion: input.candidateQuestion,
            dueDate: input.dueDate,
            verificationStatus: input.verificationStatus,
            candidateResponse: input.candidateResponse,
          },
        });
      }
    }
    throw error;
  }

  await writeNoteAudit({
    supabase,
    tenantId,
    noteId: String(inserted.id),
    jobApplicationId: applicationId,
    requirementId,
    action: "created",
    actorUserId,
    afterState: verificationNoteSnapshot(inserted),
  });

  const usersById = await loadUsersById(supabase, tenantId, [inserted.created_by, inserted.updated_by]);
  return mapVerificationNoteRow(inserted, usersById);
}

export async function updateVerificationNote(args: {
  supabase: SupabaseClient;
  tenantId: string;
  applicationId: string;
  requirementId: string;
  noteId: string;
  actorUserId: string | null;
  input: UpdateVerificationNoteInput;
}): Promise<VerificationNote> {
  const { supabase, tenantId, applicationId, requirementId, noteId, actorUserId, input } = args;

  const { data: existing, error: existingError } = await supabase
    .from("job_application_match_requirement_notes")
    .select(NOTE_SELECT)
    .eq("id", noteId)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Note not found");

  const before = verificationNoteSnapshot(existing);
  const patch: Record<string, unknown> = {
    updated_by: actorUserId,
    updated_at: new Date().toISOString(),
  };

  if (input.noteBody !== undefined) patch.note_body = input.noteBody.trim();
  if (input.candidateQuestion !== undefined) {
    patch.candidate_question = input.candidateQuestion?.trim() || null;
  }
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.verificationStatus !== undefined) {
    patch.verification_status = input.verificationStatus;
  }
  if (input.candidateResponse !== undefined) {
    const response = input.candidateResponse?.trim() || null;
    patch.candidate_response = response;
    if (response) {
      patch.candidate_responded_at = new Date().toISOString();
      if (input.verificationStatus === undefined) {
        patch.verification_status = "candidate_responded";
      }
    }
  }

  const { data: updated, error } = await supabase
    .from("job_application_match_requirement_notes")
    .update(patch)
    .eq("id", noteId)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null)
    .select(NOTE_SELECT)
    .single();
  if (error) throw error;

  const after = verificationNoteSnapshot(updated);
  const statusChanged =
    before.verification_status !== after.verification_status;
  const responseRecorded =
    Boolean(after.candidate_response) &&
    before.candidate_response !== after.candidate_response;

  let action: VerificationNoteAuditAction = "updated";
  if (responseRecorded) action = "response_recorded";
  else if (statusChanged) action = "status_changed";

  await writeNoteAudit({
    supabase,
    tenantId,
    noteId,
    jobApplicationId: applicationId,
    requirementId,
    action,
    actorUserId,
    beforeState: before,
    afterState: after,
  });

  const usersById = await loadUsersById(supabase, tenantId, [
    updated.created_by,
    updated.updated_by,
  ]);
  return mapVerificationNoteRow(updated, usersById);
}

export async function deleteVerificationNote(args: {
  supabase: SupabaseClient;
  tenantId: string;
  applicationId: string;
  requirementId: string;
  noteId: string;
  actorUserId: string | null;
}): Promise<void> {
  const { supabase, tenantId, applicationId, requirementId, noteId, actorUserId } = args;

  const { data: existing, error: existingError } = await supabase
    .from("job_application_match_requirement_notes")
    .select(NOTE_SELECT)
    .eq("id", noteId)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Note not found");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("job_application_match_requirement_notes")
    .update({
      deleted_at: now,
      updated_by: actorUserId,
      updated_at: now,
    })
    .eq("id", noteId)
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null);
  if (error) throw error;

  await writeNoteAudit({
    supabase,
    tenantId,
    noteId,
    jobApplicationId: applicationId,
    requirementId,
    action: "deleted",
    actorUserId,
    beforeState: verificationNoteSnapshot(existing),
    afterState: null,
  });
}

export async function requirementHasRecordedVerificationDecision(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  requirementId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("job_application_match_requirement_notes")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .eq("requirement_id", requirementId)
    .is("deleted_at", null)
    .limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}
