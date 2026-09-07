import { z } from "zod";

export const VERIFICATION_NOTE_STATUSES = [
  "pending",
  "sent_to_candidate",
  "candidate_responded",
  "verified",
  "rejected",
] as const;

export type VerificationNoteStatus = (typeof VERIFICATION_NOTE_STATUSES)[number];

export const VERIFICATION_NOTE_STATUS_LABELS: Record<VerificationNoteStatus, string> = {
  pending: "Pending",
  sent_to_candidate: "Sent to Candidate",
  candidate_responded: "Candidate Responded",
  verified: "Verified",
  rejected: "Rejected",
};

/** Statuses that count as a recorded verification decision (unlock Confirmed). */
export const VERIFICATION_DECISION_STATUSES = ["verified", "rejected"] as const;

export type VerificationDecisionStatus = (typeof VERIFICATION_DECISION_STATUSES)[number];

export const VERIFICATION_NOTE_AUDIT_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "status_changed",
  "response_recorded",
] as const;

export type VerificationNoteAuditAction = (typeof VERIFICATION_NOTE_AUDIT_ACTIONS)[number];

export type VerificationNote = {
  id: string;
  requirementId: string;
  jobApplicationId: string;
  workerId: string | null;
  jobRequisitionId: string | null;
  analysisVersion: number | null;
  noteBody: string;
  candidateQuestion: string | null;
  dueDate: string | null;
  verificationStatus: VerificationNoteStatus;
  candidateResponse: string | null;
  candidateRespondedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdByName: string;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VerificationNoteAuditEvent = {
  id: string;
  noteId: string;
  requirementId: string;
  jobApplicationId: string;
  action: VerificationNoteAuditAction;
  actorUserId: string | null;
  actorName: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
};

export type RequirementVerificationSummary = {
  requirementId: string;
  noteCount: number;
  latestNote: VerificationNote | null;
  hasPending: boolean;
  hasDecision: boolean;
};

export function isVerificationNoteStatus(
  value: string | null | undefined
): value is VerificationNoteStatus {
  return Boolean(value && VERIFICATION_NOTE_STATUSES.includes(value as VerificationNoteStatus));
}

export function isVerificationDecisionStatus(
  value: string | null | undefined
): value is VerificationDecisionStatus {
  return Boolean(
    value && VERIFICATION_DECISION_STATUSES.includes(value as VerificationDecisionStatus)
  );
}

export function formatVerificationNoteStatus(value: string | null | undefined): string {
  if (!value) return "Pending";
  if (isVerificationNoteStatus(value)) return VERIFICATION_NOTE_STATUS_LABELS[value];
  return value.replace(/_/g, " ");
}

export function noteHasVerificationDecision(
  note: Pick<VerificationNote, "verificationStatus">
): boolean {
  return isVerificationDecisionStatus(note.verificationStatus);
}

export function requirementHasVerificationDecision(
  notes: Array<Pick<VerificationNote, "verificationStatus">>
): boolean {
  return notes.some(noteHasVerificationDecision);
}

export function canConfirmRequirement(
  notes: Array<Pick<VerificationNote, "verificationStatus">>
): boolean {
  return requirementHasVerificationDecision(notes);
}

export function summarizeRequirementNotes(
  notes: VerificationNote[]
): Map<string, RequirementVerificationSummary> {
  const byRequirement = new Map<string, VerificationNote[]>();
  for (const note of notes) {
    const list = byRequirement.get(note.requirementId);
    if (list) list.push(note);
    else byRequirement.set(note.requirementId, [note]);
  }

  const summaries = new Map<string, RequirementVerificationSummary>();
  for (const [requirementId, list] of byRequirement) {
    const sorted = [...list].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const latestNote = sorted[0] ?? null;
    summaries.set(requirementId, {
      requirementId,
      noteCount: list.length,
      latestNote,
      hasPending: list.some(
        (n) =>
          n.verificationStatus === "pending" ||
          n.verificationStatus === "sent_to_candidate" ||
          n.verificationStatus === "candidate_responded"
      ),
      hasDecision: requirementHasVerificationDecision(list),
    });
  }
  return summaries;
}

export function verificationNoteSnapshot(row: {
  note_body?: string | null;
  candidate_question?: string | null;
  due_date?: string | null;
  verification_status?: string | null;
  candidate_response?: string | null;
  candidate_responded_at?: string | null;
  analysis_version?: number | null;
}): Record<string, unknown> {
  return {
    note_body: row.note_body ?? null,
    candidate_question: row.candidate_question ?? null,
    due_date: row.due_date ?? null,
    verification_status: row.verification_status ?? null,
    candidate_response: row.candidate_response ?? null,
    candidate_responded_at: row.candidate_responded_at ?? null,
    analysis_version: row.analysis_version ?? null,
  };
}

export const createVerificationNoteSchema = z.object({
  noteBody: z.string().trim().min(1, "Verification note is required").max(8000),
  candidateQuestion: z.string().trim().max(4000).nullable().optional(),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  verificationStatus: z.enum(VERIFICATION_NOTE_STATUSES).optional(),
  candidateResponse: z.string().trim().max(8000).nullable().optional(),
});

export const updateVerificationNoteSchema = z
  .object({
    noteBody: z.string().trim().min(1).max(8000).optional(),
    candidateQuestion: z.string().trim().max(4000).nullable().optional(),
    dueDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD")
      .nullable()
      .optional(),
    verificationStatus: z.enum(VERIFICATION_NOTE_STATUSES).optional(),
    candidateResponse: z.string().trim().max(8000).nullable().optional(),
  })
  .refine(
    (value) =>
      value.noteBody !== undefined ||
      value.candidateQuestion !== undefined ||
      value.dueDate !== undefined ||
      value.verificationStatus !== undefined ||
      value.candidateResponse !== undefined,
    { message: "At least one field is required" }
  );

export type CreateVerificationNoteInput = z.infer<typeof createVerificationNoteSchema>;
export type UpdateVerificationNoteInput = z.infer<typeof updateVerificationNoteSchema>;

export type VerificationNoteDraft = {
  noteBody: string;
  candidateQuestion: string;
  dueDate: string;
  verificationStatus: VerificationNoteStatus;
  candidateResponse: string;
};

export function mapVerificationNoteRow(
  row: {
    id: string;
    requirement_id: string;
    job_application_id: string;
    worker_id?: string | null;
    job_requisition_id?: string | null;
    analysis_version?: number | null;
    note_body: string;
    candidate_question?: string | null;
    due_date?: string | null;
    verification_status: string;
    candidate_response?: string | null;
    candidate_responded_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
    created_at: string;
    updated_at: string;
  },
  usersById: Map<string, { name: string }>
): VerificationNote {
  const status = isVerificationNoteStatus(row.verification_status)
    ? row.verification_status
    : "pending";
  const createdBy = row.created_by ? String(row.created_by) : null;
  const updatedBy = row.updated_by ? String(row.updated_by) : null;
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    jobApplicationId: String(row.job_application_id),
    workerId: row.worker_id ? String(row.worker_id) : null,
    jobRequisitionId: row.job_requisition_id ? String(row.job_requisition_id) : null,
    analysisVersion: row.analysis_version == null ? null : Number(row.analysis_version),
    noteBody: String(row.note_body),
    candidateQuestion: row.candidate_question ? String(row.candidate_question) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    verificationStatus: status,
    candidateResponse: row.candidate_response ? String(row.candidate_response) : null,
    candidateRespondedAt: row.candidate_responded_at
      ? String(row.candidate_responded_at)
      : null,
    createdBy,
    updatedBy,
    createdByName: createdBy
      ? usersById.get(createdBy)?.name ?? "Recruiter"
      : "Recruiter",
    updatedByName: updatedBy ? usersById.get(updatedBy)?.name ?? "Recruiter" : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapVerificationNoteAuditRow(
  row: {
    id: string;
    note_id: string;
    requirement_id: string;
    job_application_id: string;
    action: string;
    actor_user_id?: string | null;
    before_state?: Record<string, unknown> | null;
    after_state?: Record<string, unknown> | null;
    created_at: string;
  },
  usersById: Map<string, { name: string }>
): VerificationNoteAuditEvent {
  const actorUserId = row.actor_user_id ? String(row.actor_user_id) : null;
  return {
    id: String(row.id),
    noteId: String(row.note_id),
    requirementId: String(row.requirement_id),
    jobApplicationId: String(row.job_application_id),
    action: (VERIFICATION_NOTE_AUDIT_ACTIONS.includes(
      row.action as VerificationNoteAuditAction
    )
      ? row.action
      : "updated") as VerificationNoteAuditAction,
    actorUserId,
    actorName: actorUserId ? usersById.get(actorUserId)?.name ?? "Recruiter" : "Recruiter",
    beforeState: (row.before_state as Record<string, unknown> | null) ?? null,
    afterState: (row.after_state as Record<string, unknown> | null) ?? null,
    createdAt: String(row.created_at),
  };
}
