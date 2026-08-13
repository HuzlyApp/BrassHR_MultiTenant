import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveStaffProfilePhotoUrl } from "@/lib/account/staff-profile-photo";
import { resolveWorkerProfilePhotoUrl } from "@/lib/applicant-portal/worker-profile-photo";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";

export type AdminJobApplicationResumeHistoryItem = {
  id: string;
  fileName: string;
  fileIconType: "pdf" | "jpeg";
  uploadedAt: string;
  uploadedAtLabel: string;
  uploadedByName: string;
  uploadedByPhotoUrl: string | null;
  uploadedByType: "worker" | "staff" | "unknown";
};
export type AdminJobApplicationResumeHistoryResult = {
  jobTitle: string;
  applicationId: string;
  resumes: AdminJobApplicationResumeHistoryItem[];
};

type JobRequisitionJoin = {
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
  location?: string | null;
};

function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatPersonName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
}

function resolveFileIconType(fileName: string, fileType: string | null | undefined): "pdf" | "jpeg" {
  const mime = (fileType ?? "").toLowerCase();
  const lower = fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(lower)) return "jpeg";
  return "pdf";
}

export async function loadAdminJobApplicationResumeHistory(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
): Promise<AdminJobApplicationResumeHistoryResult | null> {
  const { data: application, error: appError } = await supabase
    .from("job_applications")
    .select(
      "id, worker_id, job_requisitions(public_title, source_job_title, source_type, employment_type, location)"
    )
    .eq("tenant_id", tenantId)
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) throw appError;
  if (!application?.id) return null;

  const workerId =
    typeof application.worker_id === "string" && application.worker_id.trim()
      ? application.worker_id.trim()
      : null;

  const jobRaw = application.job_requisitions;
  const job = (Array.isArray(jobRaw) ? jobRaw[0] : jobRaw) as JobRequisitionJoin | undefined;
  const jobTitle = job ? publicJobDisplayTitle(job).trim() || "Job" : "Job";

  if (!workerId) {
    return {
      jobTitle,
      applicationId: String(application.id),
      resumes: [],
    };
  }

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, user_id, first_name, last_name, profile_photo")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;

  const workerUserId =
    worker?.user_id != null && String(worker.user_id).trim()
      ? String(worker.user_id).trim()
      : null;
  const workerDisplayName =
    formatPersonName(
      worker?.first_name as string | null | undefined,
      worker?.last_name as string | null | undefined
    ) || "Candidate";
  const workerPhotoUrl = await resolveWorkerProfilePhotoUrl(
    supabase,
    worker?.profile_photo
  );

  const { data: resumeRows, error: resumeError } = await supabase
    .from("worker_resumes")
    .select(
      "id, original_file_name, file_name, file_type, uploaded_at, uploaded_by_user_id"
    )
    .eq("worker_id", workerId)
    .eq("job_application_id", applicationId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true });

  if (resumeError) throw resumeError;

  const uploaderIds = [
    ...new Set(
      ((resumeRows ?? []) as { uploaded_by_user_id?: string | null }[])
        .map((row) => row.uploaded_by_user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const staffNamesById = new Map<string, string>();
  const staffPhotosById = new Map<string, string | null>();
  const staffIdsToLoad = uploaderIds.filter((id) => id !== workerUserId);
  if (staffIdsToLoad.length > 0) {
    const { data: staffRows, error: staffError } = await supabase
      .from("users")
      .select("id, first_name, last_name, profile_photo")
      .in("id", staffIdsToLoad);
    if (staffError) throw staffError;
    await Promise.all(
      ((staffRows ?? []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        profile_photo: string | null;
      }[]).map(async (staff) => {
        const name = formatPersonName(staff.first_name, staff.last_name);
        staffNamesById.set(staff.id, name || "Recruiter");
        staffPhotosById.set(
          staff.id,
          await resolveStaffProfilePhotoUrl(supabase, staff.profile_photo)
        );
      })
    );
  }

  const resumes = ((resumeRows ?? []) as {
    id: string;
    original_file_name: string | null;
    file_name: string | null;
    file_type: string | null;
    uploaded_at: string;
    uploaded_by_user_id: string | null;
  }[]).map((row) => {
    const uploaderId = row.uploaded_by_user_id?.trim() || null;
    let uploadedByType: AdminJobApplicationResumeHistoryItem["uploadedByType"] = "unknown";
    let uploadedByName = "Unknown";
    let uploadedByPhotoUrl: string | null = null;
    const fileName =
      row.original_file_name?.trim() ||
      row.file_name?.trim() ||
      "Resume.pdf";

    if (uploaderId && workerUserId && uploaderId === workerUserId) {
      uploadedByType = "worker";
      uploadedByName = workerDisplayName;
      uploadedByPhotoUrl = workerPhotoUrl;
    } else if (uploaderId) {
      uploadedByType = "staff";
      uploadedByName = staffNamesById.get(uploaderId) || "Recruiter";
      uploadedByPhotoUrl = staffPhotosById.get(uploaderId) ?? null;
    } else if (workerUserId) {
      uploadedByType = "worker";
      uploadedByName = workerDisplayName;
      uploadedByPhotoUrl = workerPhotoUrl;
    }

    return {
      id: String(row.id),
      fileName,
      fileIconType: resolveFileIconType(fileName, row.file_type),
      uploadedAt: row.uploaded_at,
      uploadedAtLabel: formatUploadedAt(row.uploaded_at),
      uploadedByName,
      uploadedByPhotoUrl,
      uploadedByType,
    };
  });

  return {
    jobTitle,
    applicationId: String(application.id),
    resumes,
  };
}
