import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets";

export type ScreeningUploadRow = {
  id: string;
  questionKey: string | null;
  fileName: string;
  mimeType: string | null;
  extractedText: string | null;
  createdAt: string;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "upload";
}

export function screeningUploadStoragePath(args: {
  tenantId: string;
  applicationId: string;
  uploadId: string;
  fileName: string;
}): string {
  return `${args.tenantId}/job-applications/${args.applicationId}/screening-evidence/${args.uploadId}-${safeFileName(args.fileName)}`;
}

export async function listScreeningUploads(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
): Promise<ScreeningUploadRow[]> {
  const { data, error } = await supabase
    .from("job_application_ai_screening_uploads")
    .select("id, question_key, file_name, mime_type, extracted_text, created_at")
    .eq("tenant_id", tenantId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    questionKey: row.question_key ? String(row.question_key) : null,
    fileName: String(row.file_name),
    mimeType: row.mime_type ? String(row.mime_type) : null,
    extractedText: row.extracted_text ? String(row.extracted_text) : null,
    createdAt: String(row.created_at),
  }));
}

export { WORKER_REQUIRED_FILES_BUCKET as SCREENING_UPLOAD_BUCKET };
