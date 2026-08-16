import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractResumeTextFromUpload } from "@/lib/jobs/match-analysis/extract-resume-text";
import { createAdminJobApplication } from "@/lib/jobs/service";
import { JobValidationError } from "@/lib/jobs/types";
import { grokParseResume } from "@/lib/resume/grok-parse-resume";
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality";
import {
  resolveResumeFileType,
  validateExtractedResumeText,
  validateResumeUploadFile,
} from "@/lib/resume/validate-resume-upload";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";

const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024);

export type AdminAddCandidateFromResumeInput = {
  tenantId: string;
  jobRequisitionId: string;
  staffUserId?: string | null;
  resumeFile?: File | null;
  resumeText?: string | null;
  resumeTitle?: string | null;
};

export type AdminAddCandidateFromResumeResult = {
  applicationId: string;
  applicantProfileId: string;
  jobTitle: string;
  candidateName: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function formatCityStateZip(city: string, state: string, zip: string): string {
  const parts = [city, state, zip].map((part) => part.trim()).filter(Boolean);
  return parts.join(", ");
}

function formatFullName(firstName: string, lastName: string): string {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

async function uploadResumeBytes(
  supabase: SupabaseClient,
  tenantId: string,
  bytes: Buffer,
  fileName: string,
  contentType: string
): Promise<{ path: string; fileName: string }> {
  const safeName = sanitizeFileName(fileName || "resume.pdf");
  const path = `admin-candidates/${tenantId}/${randomUUID()}/${safeName}`;
  const { error } = await supabase.storage.from(WORKER_RESUMES_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message || "Failed to upload resume");
  }
  return { path, fileName: safeName };
}

async function persistWorkerResumeByWorkerId(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string,
  opts: {
    fileUrl: string;
    originalFileName?: string | null;
    parsedData?: Record<string, unknown>;
    textLength?: number | null;
    extractedText?: string | null;
    fileType?: string | null;
    fileSizeBytes?: number | null;
    jobApplicationId?: string | null;
  }
): Promise<void> {
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
    parsing_status: "completed" as const,
    parse_status: "completed" as const,
    parsed_at: now,
    uploaded_at: now,
    text_length: opts.textLength ?? null,
    extracted_text: opts.extractedText ?? null,
    parse_started_at: now,
    parse_completed_at: now,
    parse_error: null,
    parsed_json: opts.parsedData ?? null,
    job_application_id: opts.jobApplicationId?.trim() || null,
  };

  const { data: existing } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("worker_id", workerId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("worker_resumes").update(row).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("worker_resumes").insert(row);
  if (error) throw error;
}

export async function adminAddCandidateFromResume(
  supabase: SupabaseClient,
  input: AdminAddCandidateFromResumeInput
): Promise<AdminAddCandidateFromResumeResult> {
  const jobRequisitionId = input.jobRequisitionId.trim();
  if (!jobRequisitionId) {
    throw new JobValidationError("jobId is required.", {}, "JOB_REQUIRED");
  }

  let extractedText = "";
  let resumeBytes: Buffer | null = null;
  let resumeFileName = "resume.txt";
  let resumeContentType = "text/plain";
  let resumeFileType: ReturnType<typeof resolveResumeFileType> = "unknown";

  if (input.resumeFile && input.resumeFile.size > 0) {
    const file = input.resumeFile;
    const formatError = validateResumeUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
      maxBytes: MAX_RESUME_BYTES,
    });
    if (formatError) {
      throw new JobValidationError(formatError, {}, "INVALID_RESUME_FORMAT");
    }

    resumeFileType = resolveResumeFileType(file);
    if (resumeFileType === "doc") {
      throw new JobValidationError(
        "Legacy .doc files are not supported. Please save the resume as .docx or PDF.",
        {},
        "INVALID_RESUME_FORMAT"
      );
    }

    resumeBytes = Buffer.from(await file.arrayBuffer());
    try {
      extractedText = await extractResumeTextFromUpload(resumeBytes, file.name);
    } catch (extractError) {
      throw new JobValidationError(
        extractError instanceof Error
          ? extractError.message
          : "Could not read resume. Please upload a PDF or DOCX resume.",
        {},
        "RESUME_EXTRACTION_FAILED"
      );
    }

    resumeFileName = file.name;
    resumeContentType = file.type || "application/octet-stream";
  } else {
    const text = String(input.resumeText ?? "").trim();
    if (!text) {
      throw new JobValidationError(
        "Please upload a resume file or paste resume text.",
        {},
        "RESUME_REQUIRED"
      );
    }
    extractedText = text;
    resumeFileName = sanitizeFileName(String(input.resumeTitle ?? "").trim() || "pasted-resume.txt");
    if (!resumeFileName.toLowerCase().endsWith(".txt")) {
      resumeFileName = `${resumeFileName}.txt`;
    }
    resumeBytes = Buffer.from(text, "utf8");
    resumeFileType = "unknown";
  }

  const contentError = validateExtractedResumeText(extractedText);
  if (contentError) {
    throw new JobValidationError(contentError, {}, "INVALID_RESUME_CONTENT");
  }

  const grok = await grokParseResume(extractedText);
  const quality = evaluateResumeParseQuality(grok.normalized);
  if (!quality.ok) {
    throw new JobValidationError(
      quality.message ?? RESUME_PARSE_FAILED_USER_MESSAGE,
      {},
      "RESUME_PARSE_FAILED"
    );
  }

  const parsed = quality.normalized;
  const parsedJson = normalizedResumeToStoredJson(parsed);
  const fullName = formatFullName(parsed.first_name, parsed.last_name);
  const email = parsed.email.trim();
  const phone = parsed.phone.trim();

  if (!fullName || !email || !phone) {
    throw new JobValidationError(
      RESUME_PARSE_FAILED_USER_MESSAGE,
      {},
      "RESUME_PARSE_FAILED"
    );
  }

  if (!resumeBytes) {
    throw new JobValidationError("Resume content is missing.", {}, "RESUME_REQUIRED");
  }

  const uploaded = await uploadResumeBytes(
    supabase,
    input.tenantId,
    resumeBytes,
    resumeFileName,
    resumeContentType
  );

  const result = await createAdminJobApplication(supabase, {
    tenantId: input.tenantId,
    jobRequisitionId,
    name: fullName,
    email,
    phone,
    streetAddress: [parsed.address1, parsed.address2].filter(Boolean).join(" ").trim() || null,
    cityStateZip: formatCityStateZip(parsed.city, parsed.state, parsed.zip) || null,
    lastJobTitle: parsed.job_role.trim() || null,
    createdByStaffUserId: input.staffUserId ?? null,
    resumePath: uploaded.path,
    resumeFileName: uploaded.fileName,
  });

  const { data: profileRow } = await supabase
    .from("applicant_profiles")
    .select("worker_id")
    .eq("tenant_id", input.tenantId)
    .eq("id", result.applicantProfileId)
    .maybeSingle();

  const workerId =
    profileRow?.worker_id != null ? String(profileRow.worker_id).trim() : "";
  if (workerId) {
    await persistWorkerResumeByWorkerId(supabase, workerId, input.tenantId, {
      fileUrl: uploaded.path,
      originalFileName: uploaded.fileName,
      parsedData: parsedJson,
      textLength: extractedText.trim().length,
      extractedText,
      fileType: resumeFileType === "unknown" ? "txt" : resumeFileType,
      fileSizeBytes: resumeBytes.byteLength,
      jobApplicationId: String(result.application?.id ?? "") || null,
    });
  }

  return {
    applicationId: String(result.application?.id ?? ""),
    applicantProfileId: result.applicantProfileId,
    jobTitle: result.jobTitle,
    candidateName: fullName,
  };
}
