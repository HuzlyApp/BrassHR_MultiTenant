import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkerResumeFileUrl } from "@/lib/applicant-portal/worker-resume-service";
import { extractResumeTextFromUpload } from "@/lib/jobs/match-analysis/extract-resume-text";
import { softDeleteWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record";
import { syncWorkerPrimaryResumePath } from "@/lib/onboarding/sync-worker-primary-resume-path";
import { runResumeParseJob } from "@/lib/resume/run-resume-parse-job";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";

type ApplicationResumeContext = {
  applicationId: string;
  workerId: string;
  workerUserId: string | null;
};

async function resolveApplicationResumeContext(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
): Promise<ApplicationResumeContext | null> {
  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, worker_id")
    .eq("tenant_id", tenantId)
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  if (!application?.id) return null;

  const workerId =
    typeof application.worker_id === "string" && application.worker_id.trim()
      ? application.worker_id.trim()
      : null;
  if (!workerId) return null;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("user_id")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;

  const workerUserId =
    worker?.user_id != null && String(worker.user_id).trim()
      ? String(worker.user_id).trim()
      : null;

  return {
    applicationId: String(application.id),
    workerId,
    workerUserId,
  };
}

async function assertResumeBelongsToApplication(
  supabase: SupabaseClient,
  context: ApplicationResumeContext,
  resumeId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("worker_resumes")
    .select("id, job_application_id")
    .eq("id", resumeId)
    .eq("worker_id", context.workerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Resume not found for this application.");
  const boundApplicationId =
    typeof data.job_application_id === "string" ? data.job_application_id.trim() : "";
  if (boundApplicationId && boundApplicationId !== context.applicationId) {
    throw new Error("Resume not found for this application.");
  }
}

export async function getAdminJobApplicationResumeViewUrl(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  resumeId: string
): Promise<string | null> {
  const context = await resolveApplicationResumeContext(supabase, tenantId, applicationId);
  if (!context) return null;

  await assertResumeBelongsToApplication(supabase, context, resumeId);
  return getWorkerResumeFileUrl(supabase, context.workerId, resumeId);
}

export async function deleteAdminJobApplicationResume(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  resumeId: string
): Promise<void> {
  const context = await resolveApplicationResumeContext(supabase, tenantId, applicationId);
  if (!context) throw new Error("Application not found.");

  await assertResumeBelongsToApplication(supabase, context, resumeId);
  await softDeleteWorkerResumeRecord(supabase, context.workerId, resumeId);
  await syncWorkerPrimaryResumePath(
    supabase,
    context.workerId,
    context.workerUserId
  );
}

function resumeTextFromRow(row: {
  extracted_text?: string | null;
  parsed_data?: unknown;
}): string {
  const extracted =
    typeof row.extracted_text === "string" ? row.extracted_text.trim() : "";
  if (extracted) return extracted;
  const parsed = row.parsed_data;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const text = (parsed as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
}

export async function parseAdminJobApplicationResume(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  resumeId: string
): Promise<void> {
  const context = await resolveApplicationResumeContext(supabase, tenantId, applicationId);
  if (!context) throw new Error("Application not found.");

  await assertResumeBelongsToApplication(supabase, context, resumeId);

  const { data: row, error } = await supabase
    .from("worker_resumes")
    .select("extracted_text, parsed_data, storage_path, file_url, file_name, original_file_name")
    .eq("id", resumeId)
    .eq("worker_id", context.workerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new Error("Resume not found for this application.");

  let text = resumeTextFromRow(row);
  if (!text) {
    const path =
      (typeof row.storage_path === "string" && row.storage_path.trim()) ||
      (typeof row.file_url === "string" && row.file_url.trim()) ||
      "";
    if (!path) throw new Error("Could not read resume text to parse.");
    const { data: file, error: downloadError } = await supabase.storage
      .from(WORKER_RESUMES_BUCKET)
      .download(path);
    if (downloadError || !file) {
      throw new Error("Could not read resume text to parse.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName =
      (typeof row.original_file_name === "string" && row.original_file_name.trim()) ||
      (typeof row.file_name === "string" && row.file_name.trim()) ||
      path.split("/").pop() ||
      "resume.pdf";
    text = (await extractResumeTextFromUpload(buffer, fileName)).trim();
  }

  if (!text) throw new Error("Could not read resume text to parse.");
  await runResumeParseJob({ supabase, resumeId, text });
}
