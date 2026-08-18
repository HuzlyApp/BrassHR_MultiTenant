import type { SupabaseClient } from "@supabase/supabase-js";
import { applicationStatusLabel } from "@/lib/jobs/application-status";
import { publicJobDisplayTitle } from "@/lib/jobs/public-application-routing";

export type WorkerJobApplicationResume = {
  id: string;
  fileName: string;
  fileSizeLabel: string;
  fileType: string | null;
};

export type WorkerJobApplicationListItem = {
  id: string;
  jobTitle: string;
  companyName: string;
  workType: string;
  appliedAt: string;
  status: string;
  statusName: string;
  statusColor: string | null;
  statusNote: string | null;
  resume: WorkerJobApplicationResume | null;
};

type JobRequisitionJoin = {
  public_title?: string | null;
  source_job_title?: string | null;
  source_type?: string | null;
  employment_type?: string | null;
  facility?: string | null;
  facility_name?: string | null;
};

type ApplicationStatusJoin = {
  name?: string | null;
  system_key?: string | null;
  color?: string | null;
};

type TenantJoin = {
  name?: string | null;
};

type ApplicationRow = {
  id: string;
  status?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  application_statuses?: ApplicationStatusJoin | ApplicationStatusJoin[] | null;
  job_requisitions?: JobRequisitionJoin | JobRequisitionJoin[] | null;
  tenants?: TenantJoin | TenantJoin[] | null;
};

type StatusHistoryRow = {
  application_id?: string | null;
  note?: string | null;
};

type ResumeRow = {
  id: string;
  original_file_name?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size_bytes?: number | null;
  job_application_id?: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function companyNameFromJob(job: JobRequisitionJoin | null, tenantName: string): string {
  return job?.facility_name?.trim() || job?.facility?.trim() || tenantName || "Company";
}

export async function listWorkerJobApplications(
  supabase: SupabaseClient,
  input: { workerId: string; tenantId: string }
): Promise<WorkerJobApplicationListItem[]> {
  const { data: applications, error } = await supabase
    .from("job_applications")
    .select(
      [
        "id",
        "status",
        "status_id",
        "created_at",
        "submitted_at",
        "tenant_id",
        "application_statuses(name, system_key, color)",
        "job_requisitions(public_title, source_job_title, source_type, employment_type, facility, facility_name)",
        "tenants:tenant_id(name)",
      ].join(", ")
    )
    .eq("worker_id", input.workerId)
    .eq("tenant_id", input.tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (applications ?? []) as unknown as ApplicationRow[];
  const applicationIds = rows.map((row) => String(row.id)).filter(Boolean);

  const noteByApplication = new Map<string, string>();
  if (applicationIds.length > 0) {
    const { data: historyRows } = await supabase
      .from("application_status_history")
      .select("application_id, note, created_at")
      .eq("tenant_id", input.tenantId)
      .in("application_id", applicationIds)
      .order("created_at", { ascending: false });

    for (const history of (historyRows ?? []) as unknown as StatusHistoryRow[]) {
      const applicationId = String(history.application_id ?? "");
      if (!applicationId || noteByApplication.has(applicationId)) continue;
      const note = String(history.note ?? "").trim();
      noteByApplication.set(applicationId, note);
    }
  }

  const { data: resumeRows } = await supabase
    .from("worker_resumes")
    .select("id, original_file_name, file_name, file_type, file_size_bytes, uploaded_at, job_application_id")
    .eq("worker_id", input.workerId)
    .eq("tenant_id", input.tenantId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  const latestResumeByApplication = new Map<string, WorkerJobApplicationResume>();
  let latestResume: WorkerJobApplicationResume | null = null;

  for (const resume of (resumeRows ?? []) as unknown as ResumeRow[]) {
    const item: WorkerJobApplicationResume = {
      id: String(resume.id),
      fileName:
        String(resume.original_file_name ?? "").trim() ||
        String(resume.file_name ?? "").trim() ||
        "Resume.pdf",
      fileSizeLabel: formatFileSize(resume.file_size_bytes),
      fileType: resume.file_type ?? null,
    };
    if (!latestResume) latestResume = item;
    const linkedApplicationId = String(resume.job_application_id ?? "").trim();
    if (linkedApplicationId && !latestResumeByApplication.has(linkedApplicationId)) {
      latestResumeByApplication.set(linkedApplicationId, item);
    }
  }

  return rows.map((row) => {
    const applicationId = String(row.id);
    const status = String(row.status ?? "");
    const statusJoin = one(row.application_statuses);
    const job = one(row.job_requisitions);
    const tenant = one(row.tenants);
    const tenantName = tenant?.name?.trim() || "Company";
    const note = (noteByApplication.get(applicationId) ?? "").trim();

    return {
      id: applicationId,
      jobTitle: job ? publicJobDisplayTitle(job) || "Untitled job" : "Untitled job",
      companyName: companyNameFromJob(job, tenantName),
      workType: job?.employment_type?.trim() || "",
      appliedAt: String(row.submitted_at || row.created_at || ""),
      status,
      statusName: statusJoin?.name?.trim() || applicationStatusLabel(status),
      statusColor: statusJoin?.color?.trim() || null,
      statusNote: note || null,
      resume: latestResumeByApplication.get(applicationId) ?? latestResume,
    };
  });
}
