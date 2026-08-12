import type { SupabaseClient } from "@supabase/supabase-js";
import { dedupeJobApplicationsByJob } from "@/lib/applicant-portal/dedupe-job-applications";
import { resolveWorkerApplicationStatusLabel } from "@/lib/applicant-portal/worker-application-status";

export type ApplicantJobApplicationSummary = {
  applicationId: string;
  jobTitle: string;
  jobLocation: string | null;
  status: string;
  statusLabel: string;
  appliedAt: string;
  submittedAt: string | null;
};

function applicantFacingStatusLabel(
  status: string,
  submittedAt: string | null,
  workerStatus?: string | null
): string {
  return resolveWorkerApplicationStatusLabel({
    applicationStatus: status,
    submittedAt,
    workerStatus,
  });
}

export async function listApplicantJobApplications(
  supabase: SupabaseClient,
  input: {
    workerId: string;
    tenantId: string;
    applicantAuthUserId?: string | null;
    workerStatus?: string | null;
  }
): Promise<ApplicantJobApplicationSummary[]> {
  let query = supabase
    .from("job_applications")
    .select(
      "id, status, created_at, submitted_at, job_requisitions(id, public_title, location)"
    )
    .eq("tenant_id", input.tenantId)
    .not("status", "eq", "withdrawn")
    .order("created_at", { ascending: false });

  const authUserId = input.applicantAuthUserId?.trim();
  if (authUserId) {
    query = query.or(`worker_id.eq.${input.workerId},applicant_auth_user_id.eq.${authUserId}`);
  } else {
    query = query.eq("worker_id", input.workerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  const mapped = (data ?? []).map((row) => {
    const jobRaw = row.job_requisitions;
    const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
    const jobRecord = (job ?? {}) as {
      id?: string;
      public_title?: string | null;
      location?: string | null;
    };
    const submittedAt = row.submitted_at ? String(row.submitted_at) : null;
    const status = String(row.status ?? "");
    const jobId = String(jobRecord.id ?? "");

    return {
      applicationId: String(row.id),
      jobTitle: jobRecord.public_title?.trim() || "Job Application",
      jobLocation: jobRecord.location?.trim() || null,
      status,
      statusLabel: applicantFacingStatusLabel(status, submittedAt, input.workerStatus),
      appliedAt: String(submittedAt ?? row.created_at ?? new Date().toISOString()),
      submittedAt,
      tenantId: input.tenantId,
      jobId,
    };
  });

  return dedupeJobApplicationsByJob(mapped).map(
    ({ tenantId: _tenantId, jobId: _jobId, ...app }) => app
  );
}
