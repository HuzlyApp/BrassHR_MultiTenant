import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyResumeUploaderRole,
  countResumeUploadsForRole,
  MAX_RESUME_UPLOADS_PER_ROLE,
  ResumeUploadLimitError,
  type ResumeUploaderRole,
} from "@/lib/resume/resume-upload-limit";

export async function assertResumeUploadWithinLimit(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    workerUserId?: string | null;
    jobApplicationId?: string | null;
    uploadedByUserId?: string | null;
    role?: ResumeUploaderRole;
  }
): Promise<void> {
  const workerId = params.workerId.trim();
  if (!workerId) return;

  const role =
    params.role ??
    classifyResumeUploaderRole(params.uploadedByUserId, params.workerUserId, workerId);

  let query = supabase
    .from("worker_resumes")
    .select("uploaded_by_user_id")
    .eq("worker_id", workerId)
    .is("deleted_at", null);

  const jobApplicationId = params.jobApplicationId?.trim();
  if (jobApplicationId) {
    query = query.eq("job_application_id", jobApplicationId);
  }

  const { data, error } = await query;
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
