import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicantWorkerRow } from "@/lib/applicant-portal";
import { ResumeUploadValidationError } from "@/lib/resume/validate-resume-upload";
import { scheduleUploadedResumeProcessing } from "@/lib/resume/schedule-uploaded-resume-processing";

export async function assertApplicantApplication(
  supabase: SupabaseClient,
  applicant: ApplicantWorkerRow,
  applicationId: string
) {
  const { data, error } = await supabase.from("job_applications").select("id")
    .eq("id", applicationId).eq("worker_id", applicant.id)
    .eq("tenant_id", applicant.tenant_id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ResumeUploadValidationError("Application not found.");
}

/** Snapshot a saved resume so replacing it later cannot change another application. */
export async function importApplicantApplicationResume(
  supabase: SupabaseClient,
  applicant: ApplicantWorkerRow,
  userId: string,
  applicationId: string,
  resumeId: string
) {
  await assertApplicantApplication(supabase, applicant, applicationId);
  const { data: source, error } = await supabase.from("worker_resumes")
    .select("file_url, storage_path, original_file_name, file_name, file_type, file_size_bytes, file_hash, extracted_text, text_length, parsed_data, parsed_json, parsing_status, parse_status")
    .eq("id", resumeId).eq("worker_id", applicant.id)
    .eq("tenant_id", applicant.tenant_id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!source) throw new ResumeUploadValidationError("Select a resume from your saved resumes.");
  if ((source.parsing_status || source.parse_status) !== "completed") {
    throw new ResumeUploadValidationError("Wait for this resume to finish parsing, or choose another resume.");
  }
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await supabase.from("worker_resumes").insert({
    ...source,
    worker_id: applicant.id,
    tenant_id: applicant.tenant_id,
    job_application_id: applicationId,
    uploaded_by_user_id: userId,
    uploaded_at: now,
    parsed_at: now,
    parse_completed_at: now,
  }).select("id").single();
  if (saveError) throw saveError;
  scheduleUploadedResumeProcessing({
    supabase, resumeId: saved.id, text: source.extracted_text || "",
    workerId: applicant.id, tenantId: applicant.tenant_id,
    jobApplicationId: applicationId, analyzedByUserId: userId,
    skipParse: true, reason: "candidate_application_resume_import",
  });
  return { resumeId: saved.id };
}
