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
  jobApplicationId?: string | null;
  uploadedByUserId?: string | null;
};

export type PersistWorkerResumeRecordMode = "insert" | "update";

export type PersistWorkerResumeRecordOptions = {
  mode?: PersistWorkerResumeRecordMode;
  resumeId?: string;
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

async function writeResumeRow(
  supabase: SupabaseClient,
  attempts: Record<string, unknown>[],
  existingId?: string | null
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

function buildResumeRowAttempts(
  workerId: string,
  tenantId: string,
  opts: PersistWorkerResumeRecordOpts
): Record<string, unknown>[] {
  const parsingStatus = opts.parsingStatus ?? (opts.parsedData ? "completed" : "pending");
  const now = new Date().toISOString();
  const fileUrl = opts.fileUrl.trim();
  const originalFileName = opts.originalFileName?.trim() || null;
  const parsedData = opts.parsedData ?? {};
  const jobApplicationId = opts.jobApplicationId?.trim() || null;
  const uploadedByUserId = opts.uploadedByUserId?.trim() || null;

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
    parse_completed_at: parsingStatus === "completed" ? now : null,
    parse_error: null,
    parsed_json: null,
    ai_parse_ms: null,
    deleted_at: null,
    job_application_id: jobApplicationId,
    uploaded_by_user_id: uploadedByUserId,
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
    parse_completed_at: parsingStatus === "completed" ? now : null,
    parse_error: null,
    parsed_json: null,
    ai_parse_ms: null,
    job_application_id: jobApplicationId,
    uploaded_by_user_id: uploadedByUserId,
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

  return [fullRow, baseRow, minimalRow];
}

export async function persistWorkerResumeRecord(
  supabase: SupabaseClient,
  applicantId: string,
  opts: PersistWorkerResumeRecordOpts,
  recordOptions?: PersistWorkerResumeRecordOptions
): Promise<string | null> {
  const worker = await resolveWorkerByApplicantId(supabase, applicantId, opts.tenantId);
  if (!worker) return null;

  const mode = recordOptions?.mode ?? "insert";
  const attempts = buildResumeRowAttempts(worker.workerId, worker.tenantId, opts);

  if (mode === "update") {
    const resumeId = recordOptions?.resumeId?.trim();
    if (!resumeId) throw new Error("Resume id is required to update a resume.");

    const { data: existing, error: existingErr } = await supabase
      .from("worker_resumes")
      .select("id, job_application_id")
      .eq("id", resumeId)
      .eq("worker_id", worker.workerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing?.id) throw new Error("Resume not found.");

    const preservedJobAppId =
      opts.jobApplicationId?.trim() ||
      (existing.job_application_id as string | null) ||
      null;

    const updateAttempts = attempts.map((row) =>
      "job_application_id" in row
        ? { ...row, job_application_id: preservedJobAppId }
        : row
    );

    return writeResumeRow(supabase, updateAttempts, resumeId);
  }

  return writeResumeRow(supabase, attempts);
}

export async function softDeleteWorkerResumeRecord(
  supabase: SupabaseClient,
  workerId: string,
  resumeId: string
): Promise<void> {
  const { data: existing, error: existingErr } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("id", resumeId)
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (!existing?.id) throw new Error("Resume not found.");

  const { error } = await supabase
    .from("worker_resumes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", resumeId);
  if (error) throw error;
}
