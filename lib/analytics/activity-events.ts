import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityEventInput = {
  tenantId: string;
  actorUserId: string | null;
  departmentIdAtEvent?: string | null;
  roleAtEvent?: string | null;
  eventType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  jobId?: string | null;
  sessionId?: string | null;
  occurredAt?: string | null;
  source?: "server" | "client" | "system" | "manual" | "backfill";
  attributionType?: "actor" | "assignee" | "shared" | "system" | "manual";
  idempotencyKey?: string | null;
  /** Safe metadata only — never include salary, SSN, resume text, or keystroke content. */
  metadata?: Record<string, unknown>;
};

/**
 * Idempotent insert into analytics_activity_events.
 * Duplicate idempotency_key for the same tenant is ignored.
 */
export async function recordAnalyticsActivityEvent(
  supabase: SupabaseClient,
  input: ActivityEventInput,
): Promise<{ id: string | null; inserted: boolean; error: string | null }> {
  const eventType = input.eventType.trim();
  const module = input.module.trim() || "general";
  if (!eventType) {
    return { id: null, inserted: false, error: "eventType is required" };
  }

  const row = {
    tenant_id: input.tenantId,
    actor_user_id: input.actorUserId,
    department_id_at_event: input.departmentIdAtEvent ?? null,
    role_at_event: input.roleAtEvent ?? null,
    event_type: eventType,
    module,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    job_id: input.jobId ?? null,
    session_id: input.sessionId ?? null,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    recorded_at: new Date().toISOString(),
    source: input.source ?? "server",
    attribution_type: input.attributionType ?? "actor",
    idempotency_key: input.idempotencyKey ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("analytics_activity_events")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique violation on idempotency — treat as success without insert.
    if (error.code === "23505") {
      return { id: null, inserted: false, error: null };
    }
    return { id: null, inserted: false, error: error.message };
  }

  return { id: data?.id ? String(data.id) : null, inserted: true, error: null };
}

/** Meaningful recruiting event types used for productivity scoring. */
export const RECRUITING_MEANINGFUL_EVENT_TYPES = [
  "candidate_claimed",
  "candidate_imported",
  "application_reviewed",
  "candidate_screened",
  "candidate_shortlisted",
  "candidate_advanced",
  "candidate_rejected",
  "candidate_contacted",
  "note_added",
  "interview_scheduled",
  "interview_completed",
  "evaluation_submitted",
  "offer_created",
  "offer_sent",
  "offer_accepted",
  "hire_attributed",
  "job_created",
  "job_published",
  "job_closed",
  "status_changed",
] as const;

export type RecruitingMeaningfulEventType = (typeof RECRUITING_MEANINGFUL_EVENT_TYPES)[number];
