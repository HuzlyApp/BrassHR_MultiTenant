import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAddResumePath,
  formatDateOnlyUtc,
  isJobRequisitionOpen,
  normalizeJobToken,
  type ApplicationEntryRoute,
  type OpenJobSummary,
  resolveApplicationEntryRoute,
} from "@/lib/jobs/public-application-routing";
import { resolvePublicTenant } from "@/lib/jobs/tenant";

type DbClient = SupabaseClient;

export class JobApplicationGateError extends Error {
  readonly code: string;

  constructor(message: string, code = "JOB_APPLICATION_UNAVAILABLE") {
    super(message);
    this.name = "JobApplicationGateError";
    this.code = code;
  }
}

export type ValidatedJobApplicationTarget = {
  tenantId: string;
  tenantSlug: string;
  jobId: string;
  jobToken: string;
  workflowId: string;
  workflowName: string;
  resumeUploadPath: string;
};

const JOB_APPLICATION_SELECT =
  "id, tenant_id, public_job_token, status, workflow_id, application_deadline, onboarding_flows!workflow_id!inner(id, name, status, tenant_id)";

export async function listOpenPublishedJobSummaries(
  supabase: DbClient,
  tenantId: string,
  now: Date = new Date()
): Promise<OpenJobSummary[]> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select("public_job_token, application_deadline")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .not("workflow_id", "is", null)
    .or(`application_deadline.is.null,application_deadline.gte.${formatDateOnlyUtc(now)}`)
    .order("published_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .filter((row) => isJobRequisitionOpen(row, now))
    .map((row) => normalizeJobToken(String(row.public_job_token ?? "")))
    .filter((token): token is string => Boolean(token))
    .map((publicJobToken) => ({ publicJobToken }));
}

export async function resolveTenantApplicationEntry(
  supabase: DbClient,
  tenantSlugInput: string | null | undefined,
  now: Date = new Date()
): Promise<ApplicationEntryRoute & { tenantId?: string }> {
  const tenant = await resolvePublicTenant(supabase, tenantSlugInput);
  if (!tenant) {
    throw new JobApplicationGateError("This organization was not found.", "TENANT_NOT_FOUND");
  }

  const openJobs = await listOpenPublishedJobSummaries(supabase, tenant.id, now);
  return {
    tenantId: tenant.id,
    ...resolveApplicationEntryRoute(tenant.slug, openJobs),
  };
}

export async function validatePublishedJobForApplication(
  supabase: DbClient,
  tenantSlugInput: string | null | undefined,
  jobTokenInput: string | null | undefined,
  now: Date = new Date()
): Promise<ValidatedJobApplicationTarget> {
  const jobToken = normalizeJobToken(jobTokenInput);
  if (!jobToken) {
    throw new JobApplicationGateError(
      "A job must be selected before starting an application.",
      "JOB_TOKEN_REQUIRED"
    );
  }

  const tenant = await resolvePublicTenant(supabase, tenantSlugInput);
  if (!tenant) {
    throw new JobApplicationGateError("This organization was not found.", "TENANT_NOT_FOUND");
  }

  const { data: job, error } = await supabase
    .from("job_requisitions")
    .select(JOB_APPLICATION_SELECT)
    .eq("tenant_id", tenant.id)
    .eq("public_job_token", jobToken)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!job) {
    throw new JobApplicationGateError(
      "This job is unavailable or no longer accepting applications.",
      "JOB_NOT_FOUND"
    );
  }

  if (!isJobRequisitionOpen(job, now)) {
    throw new JobApplicationGateError(
      "This job is no longer accepting applications.",
      "JOB_CLOSED"
    );
  }

  if (!job.workflow_id) {
    throw new JobApplicationGateError(
      "This job is unavailable because no onboarding workflow is assigned.",
      "WORKFLOW_MISSING"
    );
  }

  const flow = Array.isArray(job.onboarding_flows)
    ? job.onboarding_flows[0]
    : job.onboarding_flows;

  if (!flow || flow.status !== "published") {
    throw new JobApplicationGateError(
      "This job's onboarding workflow is unavailable.",
      "WORKFLOW_UNAVAILABLE"
    );
  }

  if (String(flow.tenant_id) !== tenant.id) {
    throw new JobApplicationGateError(
      "This job's onboarding workflow is unavailable.",
      "WORKFLOW_TENANT_MISMATCH"
    );
  }

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    jobId: String(job.id),
    jobToken,
    workflowId: String(job.workflow_id),
    workflowName: String(flow.name ?? job.workflow_id),
    resumeUploadPath: buildAddResumePath(tenant.slug, jobToken),
  };
}
