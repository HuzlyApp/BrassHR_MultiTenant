import type { SupabaseClient } from "@supabase/supabase-js";
import { changeApplicationStatusBySystemKey } from "@/lib/jobs/application-statuses";
import type { ApplicationPipelineStatus } from "@/lib/jobs/application-status";

const INTERVIEWING_STATUS: ApplicationPipelineStatus = "interviewing";

/**
 * Mark a job application as interviewing.
 * Requires applicationId, or (workerId + jobId). Never falls back to "latest application by worker".
 * Writes status history via change_job_application_status RPC.
 */
export async function markApplicationInterviewing(params: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicationId?: string | null;
  jobId?: string | null;
  changedByUserId?: string | null;
}): Promise<{ updated: boolean; applicationId: string | null }> {
  const explicitApplicationId = params.applicationId?.trim() || null;

  let applicationId = explicitApplicationId;

  if (!applicationId) {
    if (!params.jobId?.trim()) {
      return { updated: false, applicationId: null };
    }

    const { data: appRow, error: findError } = await params.supabase
      .from("job_applications")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("job_requisition_id", params.jobId.trim())
      .eq("worker_id", params.workerId)
      .not("status", "in", '("rejected","withdrawn")')
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;
    applicationId = appRow?.id ?? null;
    if (!applicationId) {
      return { updated: false, applicationId: null };
    }
  }

  const result = await changeApplicationStatusBySystemKey(params.supabase, {
    tenantId: params.tenantId,
    applicationId,
    systemKey: INTERVIEWING_STATUS,
    changedByUserId: params.changedByUserId ?? null,
    note: null,
  });

  return {
    updated: !result.unchanged,
    applicationId,
  };
}
