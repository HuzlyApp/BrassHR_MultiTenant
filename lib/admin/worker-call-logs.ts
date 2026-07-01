import type { SupabaseClient } from "@supabase/supabase-js"
import type { PipelineChecklistItemKey } from "@/lib/worker-pipeline-checklist"

export type CallLogOutcome = "answered" | "no_answer"

export type WorkerCallLog = {
  id: string
  outcome: CallLogOutcome
  duration_seconds: number | null
  notes: string | null
  call_at: string
  created_at: string | null
}

const PIPELINE_TABLES = ["worker_pipeline_checklist_items", "worker_screening_checklist_items"] as const

function isMissingTableError(error: { message?: string }): boolean {
  return /not find|does not exist|schema cache/i.test(error.message ?? "")
}

export function normalizeCallLogOutcome(value: unknown): CallLogOutcome | null {
  if (value === "answered" || value === "no_answer") return value
  return null
}

export function parseDurationMinutes(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(String(value).trim())
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 60)
}

export function formatCallDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0 || Number.isNaN(seconds)) return "—"
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const rem = seconds % 60
  if (rem === 0) return `${mins}m`
  return `${mins}m ${rem}s`
}

export function callLogOutcomeLabel(outcome: CallLogOutcome): "Answered" | "Did not answer" {
  return outcome === "answered" ? "Answered" : "Did not answer"
}

export function ordinalCallAttempt(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n}st call attempt`
  if (mod10 === 2 && mod100 !== 12) return `${n}nd call attempt`
  if (mod10 === 3 && mod100 !== 13) return `${n}rd call attempt`
  return `${n}th call attempt`
}

export function pipelineItemKeyForAttempt(attemptNumber: number): PipelineChecklistItemKey | null {
  if (attemptNumber === 1) return "call_1"
  if (attemptNumber === 2) return "call_2"
  return null
}

export async function loadWorkerCallLogs(
  supabase: SupabaseClient,
  workerId: string
): Promise<WorkerCallLog[]> {
  const { data, error } = await supabase
    .from("worker_call_logs")
    .select("id, outcome, duration_seconds, notes, call_at, created_at")
    .eq("worker_id", workerId)
    .order("call_at", { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return []
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.id && row.outcome)
    .map((row) => ({
      id: String(row.id),
      outcome: row.outcome as CallLogOutcome,
      duration_seconds:
        typeof row.duration_seconds === "number" ? row.duration_seconds : null,
      notes: typeof row.notes === "string" ? row.notes : null,
      call_at: String(row.call_at ?? row.created_at ?? ""),
      created_at: row.created_at != null ? String(row.created_at) : null,
    }))
}

async function resolvePipelineTable(supabase: SupabaseClient): Promise<string | null> {
  for (const table of PIPELINE_TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1)
    if (!error) return table
    if (!isMissingTableError(error)) throw error
  }
  return null
}

export async function syncCallLogToPipelineChecklist(
  supabase: SupabaseClient,
  input: {
    workerId: string
    tenantId: string
    callLogId: string
    attemptNumber: number
    outcome: CallLogOutcome
  }
): Promise<void> {
  const itemKey = pipelineItemKeyForAttempt(input.attemptNumber)
  if (!itemKey) return

  const table = await resolvePipelineTable(supabase)
  if (!table) return

  const now = new Date().toISOString()
  const answered = input.outcome === "answered"

  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq("worker_id", input.workerId)
    .eq("item_key", itemKey)
    .maybeSingle()

  const callLogPayload = {
    call_log_ref: input.callLogId,
    call_log_completed: answered,
    call_log_completed_at: answered ? now : null,
    updated_at: now,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from(table)
      .update(callLogPayload)
      .eq("id", existing.id)
    if (error) throw error
    return
  }

  const { error } = await supabase.from(table).insert({
    tenant_id: input.tenantId,
    worker_id: input.workerId,
    item_key: itemKey,
    manual_completed: false,
    manual_completed_by: null,
    manual_completed_at: null,
    ...callLogPayload,
  })

  if (error) throw error
}

export async function createWorkerCallLog(
  supabase: SupabaseClient,
  input: {
    workerId: string
    tenantId: string
    createdByUserId: string | null
    outcome: CallLogOutcome
    durationSeconds?: number | null
    notes?: string | null
    callAt?: string | null
  }
): Promise<WorkerCallLog> {
  const { count, error: countError } = await supabase
    .from("worker_call_logs")
    .select("id", { count: "exact", head: true })
    .eq("worker_id", input.workerId)

  if (countError) throw countError
  const attemptNumber = (count ?? 0) + 1

  const notes = input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null
  const callAt = input.callAt?.trim() || new Date().toISOString()

  const { data, error } = await supabase
    .from("worker_call_logs")
    .insert({
      tenant_id: input.tenantId,
      worker_id: input.workerId,
      outcome: input.outcome,
      duration_seconds: input.durationSeconds ?? null,
      notes,
      call_at: callAt,
      created_by_user_id: input.createdByUserId,
    })
    .select("id, outcome, duration_seconds, notes, call_at, created_at")
    .single()

  if (error) throw error

  const row = data as WorkerCallLog
  await syncCallLogToPipelineChecklist(supabase, {
    workerId: input.workerId,
    tenantId: input.tenantId,
    callLogId: row.id,
    attemptNumber,
    outcome: input.outcome,
  })

  return row
}
