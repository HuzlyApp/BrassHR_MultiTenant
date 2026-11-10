import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  prepareResumeCandidate,
  resolveAdminCandidateIdentity,
} from "@/lib/jobs/admin-add-candidate-from-resume";
import { ensureAdminCandidateWorker } from "@/lib/jobs/ensure-admin-candidate-worker";
import { ensureApplicantForWorker } from "@/lib/interviews/ensure-applicant";
import {
  createAdminJobApplication,
  findActiveApplicationForJob,
} from "@/lib/jobs/service";
import { JobValidationError } from "@/lib/jobs/types";
import { normalizeApplicantEmail } from "@/lib/jobs/validation";
import { syncWorkerPrimaryResumePath } from "@/lib/onboarding/sync-worker-primary-resume-path";
import { validatePersonName } from "@/lib/person-name";
import { sanitizePostgresJson, stripNullBytes } from "@/lib/resume/sanitize-postgres-text";
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets";
import { locationFromFreeText } from "@/lib/service-area/normalize";

const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024);

export type InboundResumeResult = {
  applicant_id: string;
  email: string;
  phone: string | null;
  full_name: string;
  resume_document_id: string | null;
  linked_job_id: string | null;
  application_id: string | null;
  created: boolean;
  warnings?: string[];
};

export type InboundApplicantSummary = {
  applicant_id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  created_at: string | null;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^\d+]/g, "").trim();
}

async function findProfileByEmailOrPhone(
  supabase: SupabaseClient,
  tenantId: string,
  email: string | null,
  phone: string | null
): Promise<{ id: string; workerId: string | null; email: string | null; phone: string | null; firstName: string | null; lastName: string | null; createdAt: string | null } | null> {
  const normalizedEmail = email ? normalizeApplicantEmail(email) : "";
  if (normalizedEmail) {
    const { data, error } = await supabase
      .from("applicant_profiles")
      .select("id, worker_id, email, phone, first_name, last_name, created_at")
      .eq("tenant_id", tenantId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) {
      return {
        id: String(data.id),
        workerId: data.worker_id ? String(data.worker_id) : null,
        email: data.email ? String(data.email) : null,
        phone: data.phone ? String(data.phone) : null,
        firstName: data.first_name ? String(data.first_name) : null,
        lastName: data.last_name ? String(data.last_name) : null,
        createdAt: data.created_at ? String(data.created_at) : null,
      };
    }
  }

  const normalizedPhone = normalizePhone(phone);
  if (normalizedPhone) {
    const { data: workers, error: workerError } = await supabase
      .from("worker")
      .select("id, email, phone, first_name, last_name, created_at")
      .eq("tenant_id", tenantId)
      .not("phone", "is", null)
      .limit(50);
    if (workerError) throw workerError;
    const match = (workers ?? []).find(
      (row) => normalizePhone(String(row.phone ?? "")) === normalizedPhone
    );
    if (match?.id) {
      const { data: profile } = await supabase
        .from("applicant_profiles")
        .select("id, worker_id, email, phone, first_name, last_name, created_at")
        .eq("tenant_id", tenantId)
        .eq("worker_id", match.id)
        .maybeSingle();
      if (profile?.id) {
        return {
          id: String(profile.id),
          workerId: profile.worker_id ? String(profile.worker_id) : String(match.id),
          email: profile.email ? String(profile.email) : match.email ? String(match.email) : null,
          phone: profile.phone ? String(profile.phone) : match.phone ? String(match.phone) : null,
          firstName: profile.first_name ? String(profile.first_name) : match.first_name ? String(match.first_name) : null,
          lastName: profile.last_name ? String(profile.last_name) : match.last_name ? String(match.last_name) : null,
          createdAt: profile.created_at ? String(profile.created_at) : match.created_at ? String(match.created_at) : null,
        };
      }
      return {
        id: String(match.id),
        workerId: String(match.id),
        email: match.email ? String(match.email) : null,
        phone: match.phone ? String(match.phone) : null,
        firstName: match.first_name ? String(match.first_name) : null,
        lastName: match.last_name ? String(match.last_name) : null,
        createdAt: match.created_at ? String(match.created_at) : null,
      };
    }
  }

  return null;
}

async function resolveJobId(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string | null,
  externalReqId: string | null
): Promise<string | null> {
  if (jobId) {
    const { data, error } = await supabase
      .from("job_requisitions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      throw new JobValidationError("Job not found for job_id", {}, "NOT_FOUND");
    }
    return String(data.id);
  }
  if (!externalReqId) return null;
  const byExternalReq = await supabase
    .from("job_requisitions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_req_id", externalReqId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byExternalReq.error) throw byExternalReq.error;
  if (byExternalReq.data?.id) return String(byExternalReq.data.id);

  const byExternalRequisition = await supabase
    .from("job_requisitions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_requisition_id", externalReqId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byExternalRequisition.error) throw byExternalRequisition.error;
  if (!byExternalRequisition.data?.id) {
    throw new JobValidationError(
      "Job not found for external_req_id",
      {},
      "NOT_FOUND"
    );
  }
  return String(byExternalRequisition.data.id);
}

async function uploadInboundResume(
  supabase: SupabaseClient,
  tenantId: string,
  applicantKey: string,
  bytes: Buffer,
  fileName: string,
  contentType: string
): Promise<{ path: string; fileName: string }> {
  const safeName = sanitizeFileName(fileName || "resume.pdf");
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".")) : ".pdf";
  const path = `tenants/${tenantId}/applicants/${applicantKey}/resume${ext}`;
  const { error } = await supabase.storage.from(WORKER_RESUMES_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(error.message || "Failed to upload resume");
  return { path, fileName: safeName };
}

async function persistResumeRecords(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    workerId: string;
    path: string;
    fileName: string;
    fileType: string | null;
    fileSizeBytes: number;
    parsedData: Record<string, unknown>;
    extractedText: string;
    applicationId: string | null;
    uploadedByUserId: string | null;
    sourceLabel: string | null;
  }
): Promise<string | null> {
  const now = new Date().toISOString();
  const parsedData = sanitizePostgresJson(input.parsedData);

  {
    let selectQuery = supabase
      .from("worker_requirements")
      .select("id")
      .eq("worker_id", input.workerId)
      .eq("tenant_id", input.tenantId)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (input.applicationId) {
      selectQuery = selectQuery.eq("application_id", input.applicationId);
    }
    const { data: existingRows } = await selectQuery;
    const existingId = existingRows?.[0]?.id;
    if (existingId != null) {
      await supabase
        .from("worker_requirements")
        .update({
          resume_path: input.path,
          application_id: input.applicationId,
          updated_at: now,
        })
        .eq("id", existingId);
    } else {
      await supabase.from("worker_requirements").insert({
        tenant_id: input.tenantId,
        worker_id: input.workerId,
        application_id: input.applicationId,
        resume_path: input.path,
        updated_at: now,
      });
    }
  }

  const { data: resumeRow, error: resumeError } = await supabase
    .from("worker_resumes")
    .insert({
      worker_id: input.workerId,
      tenant_id: input.tenantId,
      file_url: input.path,
      storage_path: input.path,
      original_file_name: stripNullBytes(input.fileName),
      file_name: stripNullBytes(input.fileName),
      file_type: input.fileType,
      file_size_bytes: input.fileSizeBytes,
      parsed_data: parsedData,
      parsing_status: "completed",
      parse_status: "completed",
      parsed_at: now,
      uploaded_at: now,
      text_length: input.extractedText.trim().length,
      extracted_text: stripNullBytes(input.extractedText),
      parse_started_at: now,
      parse_completed_at: now,
      parse_error: null,
      parsed_json: parsedData,
      job_application_id: input.applicationId,
      uploaded_by_user_id: input.uploadedByUserId,
    })
    .select("id")
    .single();
  if (resumeError) throw resumeError;

  await supabase.from("worker_portal_documents").insert({
    tenant_id: input.tenantId,
    worker_id: input.workerId,
    title: input.sourceLabel ? `Resume (${input.sourceLabel})` : "Resume",
    document_type: "resume",
    file_url: input.path,
    storage_path: input.path,
    original_file_name: input.fileName,
    file_type: input.fileType,
    file_size: input.fileSizeBytes,
    status: "uploaded",
    application_id: input.applicationId,
    uploaded_at: now,
  });

  await syncWorkerPrimaryResumePath(supabase, input.workerId).catch(() => undefined);

  return resumeRow?.id ? String(resumeRow.id) : null;
}

async function workLocationFromJobOrForm(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string,
  workCity: string | null,
  workState: string | null,
  willRelocate: boolean
): Promise<{
  country: string;
  city: string;
  state: string;
  postalCode: string | null;
  locationType: "onsite";
  relocateToJobSite: boolean;
}> {
  if (workCity && workState) {
    return {
      country: "US",
      city: workCity,
      state: workState,
      postalCode: null,
      locationType: "onsite",
      relocateToJobSite: willRelocate,
    };
  }

  const { data: job } = await supabase
    .from("job_requisitions")
    .select("location, worksite_city, worksite_state, worksite_postal_code")
    .eq("tenant_id", tenantId)
    .eq("id", jobId)
    .maybeSingle();

  const city =
    workCity ||
    String(job?.worksite_city ?? "").trim() ||
    locationFromFreeText(String(job?.location ?? "")).city ||
    "Unknown";
  const state =
    workState ||
    String(job?.worksite_state ?? "").trim() ||
    locationFromFreeText(String(job?.location ?? "")).state ||
    "NA";

  return {
    country: "US",
    city,
    state,
    postalCode: job?.worksite_postal_code ? String(job.worksite_postal_code) : null,
    locationType: "onsite",
    relocateToJobSite: willRelocate,
  };
}

export async function uploadInboundApplicantResume(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    actorUserId: string | null;
    file: File;
    jobId?: string | null;
    externalReqId?: string | null;
    source?: string | null;
    workCity?: string | null;
    workState?: string | null;
    willRelocate?: boolean;
  }
): Promise<InboundResumeResult> {
  if (!input.file?.size) {
    throw new JobValidationError("Resume file is required", {}, "VALIDATION_ERROR");
  }
  if (input.file.size > MAX_RESUME_BYTES) {
    throw new JobValidationError(
      "Resume exceeds the 10 MB limit",
      {},
      "PAYLOAD_TOO_LARGE"
    );
  }

  const prepared = await prepareResumeCandidate({ resumeFile: input.file });
  const identity = resolveAdminCandidateIdentity(prepared.parsed, {});
  const warnings: string[] = [];

  if (!prepared.qualityOk && prepared.qualityMessage) {
    warnings.push(prepared.qualityMessage);
  }

  const firstNameCheck = validatePersonName(identity.firstName, { label: "First name" });
  const lastNameCheck = validatePersonName(identity.lastName, { label: "Last name" });
  const hasName = firstNameCheck.ok && lastNameCheck.ok;
  const email = identity.email?.trim() || null;
  const phone = identity.phone || null;

  if (!hasName || !email) {
    const stagingKey = randomUUID();
    await uploadInboundResume(
      supabase,
      input.tenantId,
      stagingKey,
      prepared.resumeBytes,
      prepared.resumeFileName,
      prepared.resumeContentType
    );
    const details: Record<string, string> = {};
    if (!hasName) details.name = "Could not parse name";
    if (!email) details.email = "Could not parse email";
    throw new JobValidationError(
      "Resume could not be parsed into a createable profile. File was stored for manual review.",
      details,
      "UNPROCESSABLE"
    );
  }

  if (!firstNameCheck.ok || !lastNameCheck.ok) {
    throw new JobValidationError(
      "Resume could not be parsed into a createable profile. File was stored for manual review.",
      { name: "Could not parse name" },
      "UNPROCESSABLE"
    );
  }
  const firstName = firstNameCheck.value;
  const lastName = lastNameCheck.value;
  const fullName = [firstName, lastName].join(" ");

  const linkedJobId = await resolveJobId(
    supabase,
    input.tenantId,
    input.jobId?.trim() || null,
    input.externalReqId?.trim() || null
  );

  const existing = await findProfileByEmailOrPhone(supabase, input.tenantId, email, phone);
  let created = !existing;
  let profileId = existing?.id ?? null;
  let workerId = existing?.workerId ?? null;
  let applicationId: string | null = null;

  const uploadKey = profileId ?? randomUUID();
  const uploaded = await uploadInboundResume(
    supabase,
    input.tenantId,
    uploadKey,
    prepared.resumeBytes,
    prepared.resumeFileName,
    prepared.resumeContentType
  );

  if (!profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("applicant_profiles")
      .insert({
        tenant_id: input.tenantId,
        email,
        normalized_email: normalizeApplicantEmail(email),
        first_name: firstName,
        last_name: lastName,
        phone,
        resume_path: uploaded.path,
        resume_file_name: uploaded.fileName,
      })
      .select("id, worker_id")
      .single();
    if (profileError) throw profileError;
    profileId = String(profile.id);
    workerId = profile.worker_id ? String(profile.worker_id) : null;
  } else {
    await supabase
      .from("applicant_profiles")
      .update({
        resume_path: uploaded.path,
        resume_file_name: uploaded.fileName,
        email,
        normalized_email: normalizeApplicantEmail(email),
        phone: phone || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("tenant_id", input.tenantId);
  }

  const linked = await ensureAdminCandidateWorker(supabase, {
    tenantId: input.tenantId,
    applicantProfileId: profileId,
    existingWorkerId: workerId,
    email,
    firstName,
    lastName,
    phone,
    resumePath: uploaded.path,
  });
  workerId = linked.workerId;

  if (linkedJobId) {
    const existingApp = await findActiveApplicationForJob(supabase, {
      tenantId: input.tenantId,
      jobRequisitionId: linkedJobId,
      applicantProfileId: profileId,
    });
    if (existingApp?.id) {
      applicationId = existingApp.id;
    } else {
      const workLocation = await workLocationFromJobOrForm(
        supabase,
        input.tenantId,
        linkedJobId,
        input.workCity?.trim() || null,
        input.workState?.trim() || null,
        Boolean(input.willRelocate)
      );
      try {
        const result = await createAdminJobApplication(supabase, {
          tenantId: input.tenantId,
          jobRequisitionId: linkedJobId,
          name: fullName,
          email,
          phone,
          createdByStaffUserId: input.actorUserId,
          resumePath: uploaded.path,
          resumeFileName: uploaded.fileName,
          workLocation,
          source: "api",
        });
        applicationId = String(result.application?.id ?? "").trim() || null;
      } catch (error) {
        if (
          error instanceof JobValidationError &&
          error.code === "DUPLICATE_APPLICATION"
        ) {
          const raced = await findActiveApplicationForJob(supabase, {
            tenantId: input.tenantId,
            jobRequisitionId: linkedJobId,
            applicantProfileId: profileId,
          });
          applicationId = raced?.id ?? null;
        } else {
          throw error;
        }
      }
    }
  }

  const applicantId = await ensureApplicantForWorker(
    supabase,
    input.tenantId,
    {
      id: workerId,
      first_name: firstName,
      last_name: lastName,
      email,
      status: "new",
    },
    applicationId
  );

  if (input.source?.trim()) {
    await supabase
      .from("applicants")
      .update({
        email,
        phone,
        full_name: fullName,
        resume_url: uploaded.path,
        status: "new",
      })
      .eq("id", applicantId)
      .eq("tenant_id", input.tenantId);
  }

  const resumeDocumentId = await persistResumeRecords(supabase, {
    tenantId: input.tenantId,
    workerId,
    path: uploaded.path,
    fileName: uploaded.fileName,
    fileType: prepared.resumeFileType === "unknown" ? "txt" : prepared.resumeFileType,
    fileSizeBytes: prepared.resumeBytes.byteLength,
    parsedData: prepared.parsedJson,
    extractedText: prepared.extractedText,
    applicationId,
    uploadedByUserId: input.actorUserId,
    sourceLabel: input.source?.trim() || null,
  });

  return {
    applicant_id: applicantId,
    email,
    phone,
    full_name: fullName,
    resume_document_id: resumeDocumentId,
    linked_job_id: linkedJobId,
    application_id: applicationId,
    created,
    ...(warnings.length ? { warnings } : {}),
  };
}

export async function searchInboundApplicant(
  supabase: SupabaseClient,
  tenantId: string,
  params: URLSearchParams
): Promise<InboundApplicantSummary | null> {
  const email = params.get("email")?.trim() || null;
  const phone = params.get("phone")?.trim() || null;
  const keys = [...params.keys()];
  if (keys.length !== 1 || (!email && !phone) || (email && phone)) {
    throw new JobValidationError(
      "Provide exactly one of: email or phone",
      {},
      "VALIDATION_ERROR"
    );
  }

  const match = await findProfileByEmailOrPhone(supabase, tenantId, email, phone);
  if (!match) return null;

  const fullName = [match.firstName, match.lastName].filter(Boolean).join(" ").trim();
  return {
    applicant_id: match.id,
    email: match.email,
    phone: match.phone,
    full_name: fullName || "Unknown",
    created_at: match.createdAt,
  };
}
