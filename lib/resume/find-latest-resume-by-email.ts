import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeApplicantEmail } from "@/lib/jobs/validation";

export type ExistingResumeByEmail = {
  workerId: string;
  resumeId: string;
  fileName: string;
  storagePath: string | null;
  fileHash: string | null;
  parsingStatus: string | null;
};

/**
 * Same tenant + email already has a resume on file — reuse instead of forcing a new upload.
 */
export async function findLatestResumeByEmail(
  supabase: SupabaseClient,
  args: { tenantId: string; email: string }
): Promise<ExistingResumeByEmail | null> {
  const tenantId = args.tenantId.trim();
  const email = normalizeApplicantEmail(args.email);
  if (!tenantId || !email) return null;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("email", email)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (workerError) throw workerError;
  const workerId = String(worker?.id ?? "").trim();
  if (!workerId) return null;

  const { data: resume, error: resumeError } = await supabase
    .from("worker_resumes")
    .select(
      "id, storage_path, file_url, original_file_name, file_name, file_hash, parsing_status, parse_status"
    )
    .eq("tenant_id", tenantId)
    .eq("worker_id", workerId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (resumeError) throw resumeError;
  if (!resume?.id) return null;

  const storagePath =
    (typeof resume.storage_path === "string" && resume.storage_path.trim()) ||
    (typeof resume.file_url === "string" && resume.file_url.trim()) ||
    null;
  if (!storagePath) return null;

  return {
    workerId,
    resumeId: String(resume.id),
    fileName:
      String(resume.original_file_name || resume.file_name || "").trim() || "Resume.pdf",
    storagePath,
    fileHash: typeof resume.file_hash === "string" ? resume.file_hash.trim() || null : null,
    parsingStatus: String(resume.parse_status || resume.parsing_status || "").trim() || null,
  };
}
