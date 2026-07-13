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
  fileHash?: string | null;
};

export async function persistWorkerResumeRecord(
  supabase: SupabaseClient,
  applicantId: string,
  opts: PersistWorkerResumeRecordOpts
): Promise<string | null> {
  const { data: worker, error: wErr } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .eq("user_id", applicantId)
    .maybeSingle();

  if (wErr) throw wErr;
  if (!worker?.id || worker.tenant_id == null) return null;

  const workerId = String(worker.id);
  const tenantId = String(worker.tenant_id);
  const parsingStatus = opts.parsingStatus ?? (opts.parsedData ? "completed" : "pending");
  const now = new Date().toISOString();

  const row = {
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
    parse_completed_at: null,
    parse_error: null,
    parsed_json: null,
    ai_parse_ms: null,
    file_hash: opts.fileHash ?? null,
  };

  const { data: existing } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("worker_resumes").update(row).eq("id", existing.id);
    if (error) throw error;
    return String(existing.id);
  }

  const { data: inserted, error } = await supabase
    .from("worker_resumes")
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ? String(inserted.id) : null;
}
