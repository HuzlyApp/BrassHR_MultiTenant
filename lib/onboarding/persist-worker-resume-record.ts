import type { SupabaseClient } from "@supabase/supabase-js";

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
  jobApplicationId?: string | null;
  uploadedByUserId?: string | null;
};

export type PersistWorkerResumeRecordMode = "insert" | "update";

export type PersistWorkerResumeRecordOptions = {
  mode?: PersistWorkerResumeRecordMode;
  resumeId?: string;
};

async function resolveWorkerForResume(
  supabase: SupabaseClient,
  applicantId: string
): Promise<{ workerId: string; tenantId: string } | null> {
  const byUser = await supabase
    .from("worker")
    .select("id, tenant_id")
    .eq("user_id", applicantId)
    .maybeSingle();
  if (byUser.error) throw byUser.error;

  let worker = byUser.data;
  if (!worker?.id) {
    const byId = await supabase
      .from("worker")
      .select("id, tenant_id")
      .eq("id", applicantId)
      .maybeSingle();
    if (byId.error) throw byId.error;
    worker = byId.data;
  }

  if (!worker?.id || worker.tenant_id == null) return null;
  return { workerId: String(worker.id), tenantId: String(worker.tenant_id) };
}

function buildResumeRow(
  workerId: string,
  tenantId: string,
  opts: PersistWorkerResumeRecordOpts
) {
  const parsingStatus = opts.parsingStatus ?? (opts.parsedData ? "completed" : "pending");
  const now = new Date().toISOString();

  return {
    worker_id: workerId,
    tenant_id: tenantId,
    file_url: opts.fileUrl.trim(),
    storage_path: opts.fileUrl.trim(),
    original_file_name: opts.originalFileName?.trim() || null,
    file_name: opts.originalFileName?.trim() || null,
    file_type: opts.fileType ?? null,
    file_size_bytes: opts.fileSizeBytes ?? null,
    parsed_data: opts.parsedData ?? {},
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
    job_application_id: opts.jobApplicationId?.trim() || null,
    uploaded_by_user_id: opts.uploadedByUserId?.trim() || null,
  };
}

export async function persistWorkerResumeRecord(
  supabase: SupabaseClient,
  applicantId: string,
  opts: PersistWorkerResumeRecordOpts,
  recordOptions?: PersistWorkerResumeRecordOptions
): Promise<string | null> {
  const worker = await resolveWorkerForResume(supabase, applicantId);
  if (!worker) return null;

  const mode = recordOptions?.mode ?? "insert";
  const row = buildResumeRow(worker.workerId, worker.tenantId, opts);

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

    const updateRow = {
      ...row,
      job_application_id:
        opts.jobApplicationId?.trim() ||
        (existing.job_application_id as string | null) ||
        null,
    };

    const { error } = await supabase.from("worker_resumes").update(updateRow).eq("id", resumeId);
    if (error) throw error;
    return resumeId;
  }

  const { data: inserted, error } = await supabase
    .from("worker_resumes")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ? String(inserted.id) : null;
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
