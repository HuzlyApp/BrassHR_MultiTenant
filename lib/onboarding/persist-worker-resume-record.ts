import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context";

export type WorkerResumeParsingStatus = "pending" | "processing" | "completed" | "failed";

export type PersistWorkerResumeRecordOpts = {
  fileUrl: string;
  originalFileName?: string | null;
  parsedData?: Record<string, unknown>;
  parsingStatus?: WorkerResumeParsingStatus;
  textLength?: number | null;
  extractionMs?: number | null;
  parseStartedAt?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
  extractedText?: string | null;
  tenantId?: string | null;
};

function isMissingColumnErr(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;
  if (err.code === "42703") return true;
  return typeof err.message === "string" && err.message.includes(" does not exist");
}

function describeDbErr(error: unknown, fallback: string): string {
  const err = error as { message?: string; details?: string; hint?: string } | null;
  if (!err) return fallback;
  return [err.message, err.details, err.hint].filter(Boolean).join(" — ") || fallback;
}

async function upsertResumeRow(
  supabase: SupabaseClient,
  existingId: string | null,
  attempts: Record<string, unknown>[]
): Promise<string | null> {
  let lastErr: unknown = null;

  for (const row of attempts) {
    if (existingId) {
      const { error } = await supabase.from("worker_resumes").update(row).eq("id", existingId);
      if (!error) return existingId;
      lastErr = error;
      if (!isMissingColumnErr(error)) break;
      continue;
    }

    const { data, error } = await supabase.from("worker_resumes").insert(row).select("id").single();
    if (!error) return data?.id ? String(data.id) : null;
    lastErr = error;
    if (!isMissingColumnErr(error)) break;
  }

  throw new Error(describeDbErr(lastErr, "Failed to save resume record"));
}

export async function persistWorkerResumeRecord(
  supabase: SupabaseClient,
  applicantId: string,
  opts: PersistWorkerResumeRecordOpts
): Promise<string | null> {
  const workerCtx = await resolveWorkerByApplicantId(supabase, applicantId, opts.tenantId ?? null);
  if (!workerCtx?.workerId || !workerCtx.tenantId) return null;

  const workerId = workerCtx.workerId;
  const tenantId = workerCtx.tenantId;
  const parsingStatus = opts.parsingStatus ?? (opts.parsedData ? "completed" : "pending");
  const now = new Date().toISOString();
  const fileUrl = opts.fileUrl.trim();
  const originalFileName = opts.originalFileName?.trim() || null;
  const parsedData = opts.parsedData ?? {};

  const fullRow: Record<string, unknown> = {
    worker_id: workerId,
    tenant_id: tenantId,
    file_url: fileUrl,
    storage_path: fileUrl,
    original_file_name: originalFileName,
    file_name: originalFileName,
    file_type: opts.fileType ?? null,
    file_size_bytes: opts.fileSizeBytes ?? null,
    parsed_data: parsedData,
    parsing_status: parsingStatus,
    parse_status: parsingStatus,
    parsed_at: parsingStatus === "completed" ? now : null,
    uploaded_at: now,
    text_length: opts.textLength ?? null,
    extraction_ms: opts.extractionMs ?? null,
    extracted_text: opts.extractedText ?? null,
    parse_started_at: opts.parseStartedAt ?? (parsingStatus === "processing" ? now : null),
    parse_completed_at: null,
    parse_error: null,
    parsed_json: null,
    ai_parse_ms: null,
  };

  const baseRow: Record<string, unknown> = {
    worker_id: workerId,
    tenant_id: tenantId,
    file_url: fileUrl,
    original_file_name: originalFileName,
    parsed_data: parsedData,
    parsing_status: parsingStatus,
    parsed_at: parsingStatus === "completed" ? now : null,
    uploaded_at: now,
    text_length: opts.textLength ?? null,
    extraction_ms: opts.extractionMs ?? null,
    parse_started_at: opts.parseStartedAt ?? (parsingStatus === "processing" ? now : null),
    parse_completed_at: null,
    parse_error: null,
    parsed_json: null,
    ai_parse_ms: null,
  };

  const minimalRow: Record<string, unknown> = {
    worker_id: workerId,
    tenant_id: tenantId,
    file_url: fileUrl,
    original_file_name: originalFileName,
    parsed_data: parsedData,
    parsing_status: parsingStatus,
    parsed_at: parsingStatus === "completed" ? now : null,
    uploaded_at: now,
  };

  const { data: existing } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  const existingId = existing?.id ? String(existing.id) : null;

  return upsertResumeRow(supabase, existingId, [fullRow, baseRow, minimalRow]);
}
