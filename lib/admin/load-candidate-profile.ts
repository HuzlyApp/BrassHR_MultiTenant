import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSmartInsight,
  countWorkTypes,
  formatCandidateLocation,
  isActiveApplicant,
  pickBestMatch,
  resolveOverallApplicationStatus,
  summarizeApplicationStatuses,
  summarizeWorkTypes,
  type CandidateProfileActivity,
  type CandidateProfileDocument,
  type CandidateProfilePayload,
  type CandidateProfileSubmittedResume,
} from "@/lib/admin/candidate-profile-view";
import { formatPipelineStatusLabel } from "@/lib/workers/candidate-status-label";
import { listWorkerJobApplications } from "@/lib/applicant-portal/list-worker-job-applications";
import { listWorkerResumesForApplicant } from "@/lib/applicant-portal/worker-resume-service";
import { listWorkerDocumentsForApplicant } from "@/lib/applicant-portal/worker-document-service";
import { resolveWorkerProfilePhotoUrl } from "@/lib/applicant-portal/worker-profile-photo";

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function asDetail(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(record.message) || asText(record.note) || asText(record.summary);
  }
  return "";
}

function humanizeAction(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function loadCandidateProfile(
  supabase: SupabaseClient,
  input: { workerId: string; tenantId: string }
): Promise<CandidateProfilePayload | null> {
  const { data: worker, error } = await supabase
    .from("worker")
    .select(
      "id, first_name, last_name, email, phone, address1, address2, city, state, zip, job_role, status, profile_photo, tenant_id"
    )
    .eq("id", input.workerId)
    .maybeSingle();

  if (error) throw error;
  if (!worker?.id) return null;

  const workerTenantId = asText(worker.tenant_id);
  if (workerTenantId && workerTenantId !== input.tenantId) return null;

  const [applications, photoUrl, activityResult, resumeList, documentList] = await Promise.all([
    listWorkerJobApplications(supabase, {
      workerId: input.workerId,
      tenantId: input.tenantId,
    }),
    resolveWorkerProfilePhotoUrl(supabase, worker.profile_photo),
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, details, created_at")
      .eq("entity_id", input.workerId)
      .order("created_at", { ascending: false })
      .limit(40),
    listWorkerResumesForApplicant(supabase, input.workerId, input.tenantId).catch((error) => {
      console.warn("[candidate-profile] worker_resumes", error);
      return [];
    }),
    listWorkerDocumentsForApplicant(supabase, input.workerId, input.tenantId).catch((error) => {
      console.warn("[candidate-profile] worker_documents", error);
      return [];
    }),
  ]);

  const activityRows = activityResult.error ? [] : (activityResult.data ?? []);
  if (activityResult.error) {
    console.warn("[candidate-profile] activity_logs", activityResult.error);
  }

  const firstName = asText(worker.first_name);
  const lastName = asText(worker.last_name);
  const name = `${firstName} ${lastName}`.trim() || asText(worker.email) || "Applicant";
  const workTypes = countWorkTypes(applications);
  const match = pickBestMatch(applications);
  const overallStatus = resolveOverallApplicationStatus(applications);
  const workerStatus = asText(worker.status);

  const resumes: CandidateProfileSubmittedResume[] = resumeList.map((resume) => ({
    id: resume.id,
    fileName: resume.originalFileName,
    fileSizeLabel: resume.fileSizeLabel,
    fileType: resume.fileType,
    parsingStatus: resume.parsingStatus,
    uploadedAt: resume.uploadedAt,
    uploadedAtLabel: resume.uploadedAtLabel,
    jobApplicationId: resume.jobApplicationId,
    jobTitle: resume.jobTitle,
    uploadedByName: resume.uploadedByName?.trim() || "Unknown",
    uploadedByRoleLabel: resume.uploadedByRoleLabel,
  }));

  const documents: CandidateProfileDocument[] = documentList.map((doc) => ({
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    kind: "document",
    uploadedAt: doc.uploadedAt,
    uploadedAtLabel: doc.uploadedAtLabel,
    uploadedByName: doc.uploadedByName,
    uploadedByRoleLabel: doc.uploadedByRoleLabel,
  }));

  const activity: CandidateProfileActivity[] = (activityRows as Array<Record<string, unknown>>).map(
    (row) => ({
      id: String(row.id ?? `${row.created_at}-${row.action}`),
      at: asText(row.created_at),
      title: humanizeAction(asText(row.action) || "Activity"),
      detail: asDetail(row.details) || asText(row.entity_type) || "Candidate activity",
    })
  );

  for (const application of applications) {
    if (!application.statusNote) continue;
    activity.push({
      id: `status-note-${application.id}`,
      at: application.appliedAt,
      title: `${application.jobTitle} · ${application.statusName}`,
      detail: application.statusNote,
    });
  }

  activity.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    candidate: {
      id: String(worker.id),
      name,
      firstName,
      lastName,
      email: asText(worker.email),
      phone: asText(worker.phone),
      location: formatCandidateLocation({
        address1: asText(worker.address1),
        address2: asText(worker.address2),
        city: asText(worker.city),
        state: asText(worker.state),
        zip: asText(worker.zip),
      }),
      role: asText(worker.job_role),
      status: workerStatus,
      statusLabel: formatPipelineStatusLabel(workerStatus),
      isActiveApplicant: isActiveApplicant(workerStatus, applications),
      profilePhotoUrl: photoUrl,
      yearsExperience: null,
    },
    stats: {
      totalApplications: workTypes.total,
      w2Applications: workTypes.w2,
      contractor1099Applications: workTypes.contractor1099,
      overallStatus,
    },
    match,
    applications,
    workTypeSummary: summarizeWorkTypes(applications),
    statusSummary: summarizeApplicationStatuses(applications),
    smartInsight: buildSmartInsight({
      firstName: firstName || name,
      workTypes,
      match,
    }),
    resumes,
    documents,
    activity: activity.slice(0, 40),
  };
}
