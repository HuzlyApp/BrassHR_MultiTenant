import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractResumeTextFromUpload } from "@/lib/jobs/match-analysis/extract-resume-text";
import { createAdminJobApplication } from "@/lib/jobs/service";
import { JobValidationError } from "@/lib/jobs/types";
import { grokParseResumeCached } from "@/lib/resume/grok-parse-resume-cached";
import { preExtractResumeFields } from "@/lib/resume/normalize-resume-text";
import {
  hasAdminCandidateIdentity,
  normalizeParsedResume,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
  type NormalizedParsedResume,
} from "@/lib/resumeParseQuality";
import { resumeTextToPdfBuffer } from "@/lib/resume/resume-text-to-pdf";
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
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
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

export type PreparedResumeCandidate = {
  extractedText: string;
  resumeBytes: Buffer;
  resumeFileName: string;
  resumeContentType: string;
  resumeFileType: ReturnType<typeof resolveResumeFileType>;
  parsed: NormalizedParsedResume;
  parsedJson: Record<string, string>;
  qualityOk: boolean;
  qualityMessage: string | null;
};

export function resolveAdminCandidateIdentity(
  parsed: NormalizedParsedResume,
  input: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  }
): {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
} {
  const firstName = input.firstName?.trim() || parsed.first_name.trim();
  const lastName = input.lastName?.trim() || parsed.last_name.trim();
  const email = input.email?.trim() || parsed.email.trim();
  const phone = input.phone?.trim() || parsed.phone.trim();
  return {
    firstName,
    lastName,
    fullName: formatFullName(firstName, lastName),
    email,
    phone,
  };
}

async function parseExtractedResumeText(extractedText: string): Promise<{
  parsed: NormalizedParsedResume;
  qualityOk: boolean;
  qualityMessage: string | null;
}> {
  const contentError = validateExtractedResumeText(extractedText);
  const fallback = normalizeParsedResume(preExtractResumeFields(extractedText));

  let parsed = fallback;
  if (!contentError) {
    try {
      parsed = normalizeParsedResume(await grokParseResumeCached(extractedText));
    } catch (parseError) {
      console.error("[admin-add-candidate-from-resume] grok parse failed", parseError);
      parsed = fallback;
    }
  }

  if (hasAdminCandidateIdentity(parsed)) {
    return { parsed, qualityOk: true, qualityMessage: null };
  }

  return {
    parsed,
    qualityOk: false,
    qualityMessage: contentError ?? RESUME_PARSE_FAILED_USER_MESSAGE,
  };
}

/**
 * Validate, extract, and AI-parse a resume upload (or pasted text).
 * Shared by the parse preview endpoint and the candidate create flow; the Grok call is
 * cached by text, so previewing then submitting the same resume parses only once.
 */
export async function prepareResumeCandidate(input: {
  resumeFile?: File | null;
  resumeText?: string | null;
  resumeTitle?: string | null;
}): Promise<PreparedResumeCandidate> {
  let extractedText = "";
  let resumeBytes: Buffer | null = null;
  let resumeFileName = "resume.pdf";
  let resumeContentType = "application/pdf";
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
      console.error("[admin-add-candidate-from-resume] resume extraction failed", extractError);
      extractedText = "";
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
    const titleBase = sanitizeFileName(String(input.resumeTitle ?? "").trim() || "pasted-resume");
    resumeFileName = titleBase.toLowerCase().endsWith(".pdf") ? titleBase : `${titleBase}.pdf`;
    // UTF-8 placeholder — converted to PDF only when uploading to storage.
    resumeBytes = Buffer.from(extractedText, "utf8");
    resumeContentType = "application/pdf";
    resumeFileType = "pdf";
  }

  if (!resumeBytes) {
    throw new JobValidationError("Resume content is missing.", {}, "RESUME_REQUIRED");
  }

  const { parsed, qualityOk, qualityMessage } = await parseExtractedResumeText(extractedText);

  return {
    extractedText,
    resumeBytes,
    resumeFileName,
    resumeContentType,
    resumeFileType,
    parsed,
    parsedJson: normalizedResumeToStoredJson(parsed),
    qualityOk,
    qualityMessage,
  };
}

export async function adminAddCandidateFromResume(
  supabase: SupabaseClient,
  input: AdminAddCandidateFromResumeInput
): Promise<AdminAddCandidateFromResumeResult> {
  const jobRequisitionId = input.jobRequisitionId.trim();
  if (!jobRequisitionId) {
    throw new JobValidationError("jobId is required.", {}, "JOB_REQUIRED");
  }

  const {
    extractedText,
    resumeBytes,
    resumeFileName,
    resumeContentType,
    resumeFileType,
    parsed,
  } = await prepareResumeCandidate({
    resumeFile: input.resumeFile,
    resumeText: input.resumeText,
    resumeTitle: input.resumeTitle,
  });

  const { firstName: resolvedFirstName, lastName: resolvedLastName, fullName, email, phone } =
    resolveAdminCandidateIdentity(parsed, input);

  if (!fullName) {
    throw new JobValidationError(
      "First and last name are required. Fill them in and try again.",
      { name: "Name is required." },
      "NAME_REQUIRED"
    );
  }
  if (!email) {
    throw new JobValidationError(
      "Email is required. Fill it in and try again.",
      { email: "Email is required." },
      "EMAIL_REQUIRED"
    );
  }

  const parsedJson = normalizedResumeToStoredJson({
    ...parsed,
    first_name: resolvedFirstName,
    last_name: resolvedLastName,
    email,
    phone,
  });

  const uploadBytes =
    !input.resumeFile?.size && input.resumeText?.trim()
      ? await resumeTextToPdfBuffer(extractedText)
      : resumeBytes;

  const uploaded = await uploadResumeBytes(
    supabase,
    input.tenantId,
    uploadBytes,
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
