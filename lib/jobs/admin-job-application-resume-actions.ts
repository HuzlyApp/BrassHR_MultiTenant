import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getWorkerResumeFileUrl } from "@/lib/applicant-portal/worker-resume-service";
import { softDeleteWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record";
import { syncWorkerPrimaryResumePath } from "@/lib/onboarding/sync-worker-primary-resume-path";

type ApplicationResumeContext = {
  applicationId: string;
  workerId: string;
  workerUserId: string | null;
};

async function resolveApplicationResumeContext(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string
): Promise<ApplicationResumeContext | null> {
  const { data: application, error } = await supabase
    .from("job_applications")
    .select("id, worker_id")
    .eq("tenant_id", tenantId)
    .eq("id", applicationId)
    .maybeSingle();
  if (error) throw error;
  if (!application?.id) return null;

  const workerId =
    typeof application.worker_id === "string" && application.worker_id.trim()
      ? application.worker_id.trim()
      : null;
  if (!workerId) return null;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("user_id")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;

  const workerUserId =
    worker?.user_id != null && String(worker.user_id).trim()
      ? String(worker.user_id).trim()
      : null;

  return {
    applicationId: String(application.id),
    workerId,
    workerUserId,
  };
}

async function assertResumeBelongsToApplication(
  supabase: SupabaseClient,
  context: ApplicationResumeContext,
  resumeId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("worker_resumes")
    .select("id")
    .eq("id", resumeId)
    .eq("worker_id", context.workerId)
    .eq("job_application_id", context.applicationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Resume not found for this application.");
}

export async function getAdminJobApplicationResumeViewUrl(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  resumeId: string
): Promise<string | null> {
  const context = await resolveApplicationResumeContext(supabase, tenantId, applicationId);
  if (!context) return null;

  await assertResumeBelongsToApplication(supabase, context, resumeId);
  return getWorkerResumeFileUrl(supabase, context.workerId, resumeId);
}

export async function deleteAdminJobApplicationResume(
  supabase: SupabaseClient,
  tenantId: string,
  applicationId: string,
  resumeId: string
): Promise<void> {
  const context = await resolveApplicationResumeContext(supabase, tenantId, applicationId);
  if (!context) throw new Error("Application not found.");

  await assertResumeBelongsToApplication(supabase, context, resumeId);
  await softDeleteWorkerResumeRecord(supabase, context.workerId, resumeId);
  await syncWorkerPrimaryResumePath(
    supabase,
    context.workerId,
    context.workerUserId
  );
}
