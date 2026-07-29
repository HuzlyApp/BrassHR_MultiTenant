import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationPipelineStatus } from "@/lib/jobs/application-status";

const INTERVIEWING_STATUS: ApplicationPipelineStatus = "interviewing";

export async function markApplicationInterviewing(params: {
  supabase: SupabaseClient;
  tenantId: string;
  workerId: string;
  applicationId?: string | null;
  jobId?: string | null;
}): Promise<{ updated: boolean; applicationId: string | null }> {
  const explicitApplicationId = params.applicationId?.trim() || null;

  if (explicitApplicationId) {
    const { data, error } = await params.supabase
      .from("job_applications")
      .update({
        status: INTERVIEWING_STATUS,
        updated_at: new Date().toISOString(),
      })
      .eq("id", explicitApplicationId)
      .eq("tenant_id", params.tenantId)
      .select("id")
      .maybeSingle();

    if (error) throw error;

    return {
      updated: Boolean(data?.id),
      applicationId: data?.id ?? explicitApplicationId,
    };
  }

  let applicationId: string | null = null;

  if (params.jobId?.trim()) {
    const { data, error } = await params.supabase
      .from("job_applications")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("job_requisition_id", params.jobId.trim())
      .eq("worker_id", params.workerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    applicationId = data?.id ?? null;
  }

  if (!applicationId) {
    const { data, error } = await params.supabase
      .from("job_applications")
      .select("id")
      .eq("tenant_id", params.tenantId)
      .eq("worker_id", params.workerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    applicationId = data?.id ?? null;
  }

  if (!applicationId) {
    return { updated: false, applicationId: null };
  }

  const { data, error } = await params.supabase
    .from("job_applications")
    .update({
      status: INTERVIEWING_STATUS,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("tenant_id", params.tenantId)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return { updated: Boolean(data?.id), applicationId: data?.id ?? applicationId };
}
