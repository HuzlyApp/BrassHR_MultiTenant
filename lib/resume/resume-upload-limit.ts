import { ResumeUploadValidationError } from "@/lib/resume/validate-resume-upload";

export const MAX_RESUME_UPLOADS_PER_ROLE = 5;

export type ResumeUploaderRole = "worker" | "admin";

export class ResumeUploadLimitError extends ResumeUploadValidationError {
  readonly code = "RESUME_UPLOAD_LIMIT";
  readonly role: ResumeUploaderRole;

  constructor(role: ResumeUploaderRole, max = MAX_RESUME_UPLOADS_PER_ROLE) {
    super(resumeUploadLimitMessage(role, max));
    this.name = "ResumeUploadLimitError";
    this.role = role;
  }
}

export function isResumeUploadLimitError(error: unknown): boolean {
  return error instanceof ResumeUploadLimitError;
}

export function resumeUploadLimitMessage(
  role: ResumeUploaderRole,
  max = MAX_RESUME_UPLOADS_PER_ROLE
): string {
  if (role === "admin") {
    return `Admins can upload a resume up to ${max} times for this job. Delete one from history to upload another.`;
  }
  return `You can upload a resume up to ${max} times for this job. Delete one or reupload an existing file.`;
}

export function classifyResumeUploaderRole(
  uploadedByUserId: string | null | undefined,
  workerUserId: string | null | undefined,
  workerId?: string | null
): ResumeUploaderRole {
  const uploader = uploadedByUserId?.trim() || "";
  if (!uploader) return "worker";

  const workerUser = workerUserId?.trim() || "";
  if (workerUser && uploader === workerUser) return "worker";

  const workerRecordId = workerId?.trim() || "";
  if (workerRecordId && uploader === workerRecordId) return "worker";

  return "admin";
}

export function countResumeUploadsForRole(
  rows: Array<{ uploaded_by_user_id?: string | null }>,
  role: ResumeUploaderRole,
  workerUserId: string | null | undefined,
  workerId?: string | null
): number {
  return rows.filter(
    (row) =>
      classifyResumeUploaderRole(row.uploaded_by_user_id, workerUserId, workerId) === role
  ).length;
}
