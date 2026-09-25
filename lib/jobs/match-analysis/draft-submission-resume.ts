import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeActivityLog } from "@/lib/audit/activity-log";
import { sanitizePostgresJson, stripNullBytes } from "@/lib/resume/sanitize-postgres-text";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";
import { isDeepMatchStage } from "./match-stage";
import { matchAnalysisResponseSchema, type MatchAnalysisResponse } from "./schema";
import { generateOptimizedSubmissionResume } from "./generate-submission-resume";
import { loadSubmissionEnrichmentNotes } from "./submission-enrichment";
import { isSubmissionResumeFileName, submissionResumeFileName, submissionResumeToPlainText } from "./submission-resume";
import { renderSubmissionResumePdf } from "./submission-resume-pdf";

export class SubmissionResumeError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SubmissionResumeError";
    this.status = status;
  }
}

export type DraftSubmissionResumeResult = {
  pdf: Buffer;
  fileName: string;
  resumeId: string;
  stage: "submission";
  usedModel: boolean;
};

function parseStoredAnalysis(value: unknown): MatchAnalysisResponse | null {
  const parsed = matchAnalysisResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function loadSourceResumeText(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  workerId: string | null
): Promise<string> {
  const { data: scoped } = await supabase
    .from("worker_resumes")
    .select("extracted_text, file_name, original_file_name, uploaded_at")
    .eq("tenant_id", tenantId)
    .eq("job_application_id", applicationId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(8);

  let rows = scoped ?? [];
  if (!rows.length && workerId) {
    const { data: workerRows } = await supabase
      .from("worker_resumes")
      .select("extracted_text, file_name, original_file_name, uploaded_at")
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
      .limit(8);
    rows = workerRows ?? [];
  }

  const preferred =
    rows.find((row) => !isSubmissionResumeFileName(String(row.original_file_name || row.file_name || ""))) ??
    rows[0];
  return String(preferred?.extracted_text ?? "").trim();
}

export async function draftSubmissionResumePack(args: {
  supabase: SupabaseClient;
  tenantId: string;
  applicationId: string;
  staffUserId: string | null;
}): Promise<DraftSubmissionResumeResult> {
  const { supabase, tenantId, applicationId, staffUserId } = args;

  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select(
      "id, tenant_id, worker_id, applicant_profile_id, job_requisition_id, ai_match_status, ai_match_stage, ai_analysis"
    )
    .eq("id", applicationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (appError) throw new SubmissionResumeError(appError.message, 500);
  if (!application) throw new SubmissionResumeError("Application not found", 404);
  if (application.ai_match_status !== "ANALYZED") {
    throw new SubmissionResumeError("Run Deep Match before drafting the submission résumé.", 409);
  }
  if (!isDeepMatchStage(application.ai_match_stage)) {
    throw new SubmissionResumeError("Run Deep Match before drafting the submission résumé.", 409);
  }

  const [{ data: worker }, { data: profile }, { data: job }] = await Promise.all([
    application.worker_id
      ? supabase
          .from("worker")
          .select("id, first_name, last_name, email, phone, city, state")
          .eq("id", application.worker_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    application.applicant_profile_id
      ? supabase
          .from("applicant_profiles")
          .select("first_name, last_name, email, phone, city_state_zip")
          .eq("id", application.applicant_profile_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("job_requisitions")
      .select("title, public_title")
      .eq("id", application.job_requisition_id)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const firstName = String(worker?.first_name || profile?.first_name || "").trim();
  const lastName = String(worker?.last_name || profile?.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || "Candidate";
  const location =
    String(profile?.city_state_zip || "").trim() ||
    [worker?.city, worker?.state].map((part) => String(part || "").trim()).filter(Boolean).join(", ");
  const identity = {
    fullName,
    email: String(profile?.email || worker?.email || "").trim(),
    phone: String(profile?.phone || worker?.phone || "").trim(),
    location,
    jobTitle: String(job?.public_title || job?.title || "").trim() || "this assignment",
  };

  const analysis = parseStoredAnalysis(application.ai_analysis);
  const workerId = application.worker_id ? String(application.worker_id) : null;
  const [resumeText, enrichmentNotes] = await Promise.all([
    loadSourceResumeText(supabase, tenantId, applicationId, workerId),
    loadSubmissionEnrichmentNotes({
      supabase,
      tenantId,
      applicationId,
      workerId,
      analysis,
    }),
  ]);
  if (!resumeText && !analysis) {
    throw new SubmissionResumeError("No résumé text is available to optimize.", 409);
  }

  const { resume, usedModel } = await generateOptimizedSubmissionResume({
    identity,
    analysis,
    resumeText,
    enrichmentNotes,
  });
  const pdf = await renderSubmissionResumePdf(resume);
  const fileName = submissionResumeFileName(resume.fullName || fullName);
  const extractedText = submissionResumeToPlainText(resume);
  const storagePath = `submission-resumes/${tenantId}/${applicationId}/${randomUUID()}.pdf`;

  const { error: uploadError } = await supabase.storage.from(WORKER_RESUMES_BUCKET).upload(storagePath, pdf, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    throw new SubmissionResumeError(uploadError.message || "Failed to store the submission résumé.", 502);
  }

  const now = new Date().toISOString();
  if (!workerId) {
    throw new SubmissionResumeError("This application has no candidate record to attach the résumé to.", 409);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("worker_resumes")
    .insert({
      worker_id: workerId,
      tenant_id: tenantId,
      file_url: storagePath,
      storage_path: storagePath,
      original_file_name: fileName,
      file_name: fileName,
      file_type: "application/pdf",
      file_size_bytes: pdf.byteLength,
      parsed_data: sanitizePostgresJson(resume),
      parsing_status: "completed",
      parse_status: "completed",
      parsed_at: now,
      uploaded_at: now,
      text_length: extractedText.length,
      extracted_text: stripNullBytes(extractedText),
      parse_started_at: now,
      parse_completed_at: now,
      parse_error: null,
      parsed_json: sanitizePostgresJson(resume),
      job_application_id: applicationId,
      uploaded_by_user_id: staffUserId,
    })
    .select("id")
    .single();
  if (insertError || !inserted?.id) {
    throw new SubmissionResumeError(insertError?.message || "Failed to save the submission résumé.", 500);
  }

  if (application.ai_match_stage !== "submission") {
    const { error: stageError } = await supabase
      .from("job_applications")
      .update({
        ai_match_stage: "submission",
        updated_at: now,
      })
      .eq("id", applicationId)
      .eq("tenant_id", tenantId);
    if (stageError) throw new SubmissionResumeError(stageError.message, 500);
  }

  void writeActivityLog({
    actorUserId: staffUserId,
    action: "job_application.submission_resume_drafted",
    entityType: "job_application",
    entityId: applicationId,
    tenantId,
    metadata: { resumeId: inserted.id, fileName, usedModel },
  });

  return {
    pdf,
    fileName,
    resumeId: String(inserted.id),
    stage: "submission",
    usedModel,
  };
}
