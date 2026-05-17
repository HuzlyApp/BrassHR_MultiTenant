import type { SupabaseClient } from "@supabase/supabase-js";

export async function persistWorkerResumeRecord(
  supabase: SupabaseClient,
  applicantId: string,
  opts: {
    fileUrl: string;
    originalFileName?: string | null;
    parsedData?: Record<string, unknown>;
    parsingStatus?: "pending" | "processing" | "completed" | "failed";
  }
): Promise<void> {
  const { data: worker, error: wErr } = await supabase
    .from("worker")
    .select("id, tenant_id")
    .eq("user_id", applicantId)
    .maybeSingle();

  if (wErr) throw wErr;
  if (!worker?.id || worker.tenant_id == null) return;

  const workerId = String(worker.id);
  const tenantId = String(worker.tenant_id);
  const parsingStatus = opts.parsingStatus ?? (opts.parsedData ? "completed" : "pending");
  const now = new Date().toISOString();

  const row = {
    worker_id: workerId,
    tenant_id: tenantId,
    file_url: opts.fileUrl.trim(),
    original_file_name: opts.originalFileName?.trim() || null,
    parsed_data: opts.parsedData ?? {},
    parsing_status: parsingStatus,
    parsed_at: parsingStatus === "completed" ? now : null,
    uploaded_at: now,
  };

  const { data: existing } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("worker_resumes").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("worker_resumes").insert(row);
    if (error) throw error;
  }
}
