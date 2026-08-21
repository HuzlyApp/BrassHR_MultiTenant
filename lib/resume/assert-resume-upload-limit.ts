import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyResumeUploaderRole,
  countResumeUploadsForRole,
  MAX_RESUME_UPLOADS_PER_ROLE,
  ResumeUploadLimitError,
  type ResumeUploaderRole,
} from "@/lib/resume/resume-upload-limit";

/**
 * Guards a *new* resume record. The quota is per candidate per role across all
 * jobs, so applying to more jobs never widens it. Reuploads replace an existing
 * record and must not call this.
 */
export async function assertResumeUploadWithinLimit(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    workerUserId?: string | null;
    uploadedByUserId?: string | null;
    role?: ResumeUploaderRole;
  }
): Promise<void> {
  const workerId = params.workerId.trim();
  if (!workerId) return;

  const role =
    params.role ??
    classifyResumeUploaderRole(params.uploadedByUserId, params.workerUserId, workerId);

  const { data, error } = await supabase
    .from("worker_resumes")
    .select("uploaded_by_user_id")
    .eq("worker_id", workerId)
    .is("deleted_at", null);
  if (error) throw error;

  const used = countResumeUploadsForRole(
    (data ?? []) as Array<{ uploaded_by_user_id?: string | null }>,
    role,
    params.workerUserId,
    workerId
  );

  if (used >= MAX_RESUME_UPLOADS_PER_ROLE) {
    throw new ResumeUploadLimitError(role);
  }
}
