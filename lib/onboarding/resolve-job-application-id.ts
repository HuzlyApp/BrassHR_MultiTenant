import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";

/**
 * Resolve the applicant's job_applications.id for a public job token.
 * Used to scope onboarding progress per application.
 */
export async function resolveJobApplicationIdForApplicant(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    applicantAuthUserId: string;
    jobToken?: string | null;
    applicationId?: string | null;
    workerId?: string | null;
  }
): Promise<string | null> {
  const explicit = input.applicationId?.trim();
  if (explicit) return explicit;

  const jobToken = normalizeJobToken(input.jobToken);
  if (!jobToken) return null;

  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("public_job_token", jobToken)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job?.id) return null;

  const { data: byAuth, error: byAuthError } = await supabase
    .from("job_applications")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("job_requisition_id", job.id)
    .eq("applicant_auth_user_id", input.applicantAuthUserId)
    .not("status", "in", '("rejected","withdrawn")')
    .maybeSingle();
  if (byAuthError) throw byAuthError;
  if (byAuth?.id) return String(byAuth.id);

  if (input.workerId) {
    const { data: byWorker, error: byWorkerError } = await supabase
      .from("job_applications")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("job_requisition_id", job.id)
      .eq("worker_id", input.workerId)
      .not("status", "in", '("rejected","withdrawn")')
      .maybeSingle();
    if (byWorkerError) throw byWorkerError;
    if (byWorker?.id) return String(byWorker.id);
  }

  return null;
}
