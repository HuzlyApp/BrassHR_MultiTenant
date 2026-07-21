import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";import {
  JobValidationError,
  type JobRequisitionInput,
  type JobStatus,
  type WorkflowMatch,
} from "@/lib/jobs/types";
import {
  normalizeApplicantEmail,
  validatePublishableJob,
  workflowNoMatchMessage,
} from "@/lib/jobs/validation";
import {
  isJobRequisitionOpen,
  normalizeJobToken,
} from "@/lib/jobs/public-application-routing";
import { resolveWorkflowMatch } from "@/lib/workflow-mappings/service";

type DbClient = SupabaseClient;

export { resolveWorkflowMatch };

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function toJobRow(input: JobRequisitionInput) {
  const publicTitle = clean(input.publicTitle);
  const publicDescription = clean(input.publicDescription);
  const facility = clean(input.facility);
  const duration = clean(input.duration);
  const benefits = clean(input.benefits);
  const mspClient = clean(input.mspClient);
  const externalRequisitionId = clean(input.externalRequisitionId);

  return {
    internal_requisition_number: clean(input.internalRequisitionNumber),
    external_requisition_id: externalRequisitionId,
    source_type: input.sourceType,
    msp_client: mspClient,
    profession_id: input.professionId,
    specialty_id: clean(input.specialtyId),
    employment_type: input.employmentType,
    employer_of_record: clean(input.employerOfRecord),
    department: clean(input.department),
    facility,
    bill_rate: input.billRate ?? null,
    pay_rate_min: input.payRateMin ?? null,
    pay_rate_max: input.payRateMax ?? null,
    target_start_date: clean(input.targetStartDate),
    duration,
    shift_type: clean(input.shiftType),
    shift_details: clean(input.shiftDetails),
    hours_per_week: input.hoursPerWeek ?? null,
    public_title: publicTitle,
    public_description: publicDescription,
    location: clean(input.location),
    schedule: clean(input.schedule),
    qualifications: clean(input.qualifications),
    responsibilities: clean(input.responsibilities),
    benefits,
    application_deadline: clean(input.applicationDeadline),
    // Legacy columns still required on upgraded job_requisitions tables.
    title: publicTitle ?? "Untitled job",
    description: publicDescription,
    placement_type: "Internal",
    external_req_id: externalRequisitionId,
    msp_client_name: mspClient,
    facility_name: facility,
    job_duration: duration,
    benefits_summary: benefits,
    pay_rate: input.payRateMin ?? input.payRateMax ?? null,
  };
}


async function routingKeyChanged(
  supabase: DbClient,
  tenantId: string,
  jobId: string,
  input: JobRequisitionInput
): Promise<boolean> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select("profession_id, employment_type")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return (
    String(data.profession_id) !== input.professionId ||
    String(data.employment_type) !== input.employmentType
  );
}

async function countActiveApplicantsForJob(
  supabase: DbClient,
  tenantId: string,
  jobId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("job_applications")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("job_requisition_id", jobId)
    .neq("status", "withdrawn");
  if (error) throw error;
  return count ?? 0;
}

async function professionName(
  supabase: DbClient,
  tenantId: string,
  professionId: string
): Promise<string> {
  const { data } = await supabase
    .from("professions")
    .select("name")
    .eq("id", professionId)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .maybeSingle();
  return data?.name ? String(data.name) : professionId;
}

async function requirePublishable(
  supabase: DbClient,
  tenantId: string,
  input: JobRequisitionInput,
  match: WorkflowMatch | null
): Promise<void> {
  const fieldErrors = validatePublishableJob(input, match?.workflowId ?? null);
  if (Object.keys(fieldErrors).length === 0) return;

  let message = "Complete the required fields before publishing.";
  if (!match) {
    message = workflowNoMatchMessage(await professionName(supabase, tenantId, input.professionId), {
      employmentType: input.employmentType,
    });
  }
  throw new JobValidationError(message, fieldErrors);
}

async function resolvePublicJobTokenForPublish(
  supabase: DbClient,
  tenantId: string,
  jobId?: string
): Promise<string | undefined> {
  if (jobId) {
    const { data, error } = await supabase
      .from("job_requisitions")
      .select("public_job_token")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;
    if (normalizeJobToken(data?.public_job_token ? String(data.public_job_token) : null)) {
      return undefined;
    }
  }
  return randomUUID();
}

export async function saveJobRequisition(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  input: JobRequisitionInput,
  options: { jobId?: string; publish: boolean; confirmRoutingChange?: boolean }
) {
  if (options.jobId) {
    const { data: existingJob, error: existingJobError } = await supabase
      .from("job_requisitions")
      .select("status")
      .eq("id", options.jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existingJobError) throw existingJobError;

    if (existingJob?.status === "published") {
      const routingChanged = await routingKeyChanged(supabase, tenantId, options.jobId, input);
      if (routingChanged) {
        const applicantCount = await countActiveApplicantsForJob(
          supabase,
          tenantId,
          options.jobId
        );
        if (applicantCount > 0 && !options.confirmRoutingChange) {
          throw new JobValidationError(
            "Changing profession or employment type will assign a different workflow for new applicants. Existing applicants remain on their original workflow. Confirm to continue.",
            { professionId: "Confirm routing change to update workflow assignment." },
            "ROUTING_CHANGE_CONFIRMATION_REQUIRED"
          );
        }
      }
    }
  }

  const match = await resolveWorkflowMatch(supabase, tenantId, input);
  if (options.publish) await requirePublishable(supabase, tenantId, input, match);

  const now = new Date().toISOString();
  const publicJobToken = options.publish
    ? await resolvePublicJobTokenForPublish(supabase, tenantId, options.jobId)
    : undefined;
  const patch = {
    ...toJobRow(input),
    workflow_id: match?.workflowId ?? null,
    status: options.publish ? ("published" as const) : ("draft" as const),
    published_at: options.publish ? now : null,
    closed_at: null,
    archived_at: null,
    updated_by: actorUserId,
    ...(publicJobToken ? { public_job_token: publicJobToken } : {}),
  };

  if (options.jobId) {
    const { data, error } = await supabase
      .from("job_requisitions")
      .update(patch)
      .eq("id", options.jobId)
      .eq("tenant_id", tenantId)
      .select(
        "*, professions(name), specialties(name), onboarding_flows!workflow_id(name)"
      )
      .single();
    if (error) throw error;
    return { job: data, workflow: match };
  }

  const { data, error } = await supabase
    .from("job_requisitions")
    .insert({
      ...patch,
      tenant_id: tenantId,
      created_by: actorUserId,
    })
    .select(
      "*, professions(name), specialties(name), onboarding_flows!workflow_id(name)"
    )
    .single();
  if (error) throw error;
  return { job: data, workflow: match };
}

export async function transitionJobStatus(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  jobId: string,
  status: Exclude<JobStatus, "published">
) {
  const now = new Date().toISOString();
  const patch = {
    status,
    updated_by: actorUserId,
    published_at: status === "draft" ? null : undefined,
    closed_at: status === "closed" ? now : null,
    archived_at: status === "archived" ? now : null,
  };

  const { data, error } = await supabase
    .from("job_requisitions")
    .update(patch)
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .select("id, status, published_at, closed_at, archived_at")
    .single();
  if (error) throw error;
  return data;
}

export async function listInternalJobs(
  supabase: DbClient,
  tenantId: string,
  filters: {
    status?: JobStatus;
    professionId?: string;
    employmentType?: string;
    createdBy?: string;
  } = {}
) {
  let query = supabase
    .from("job_requisitions")
    .select(
      "id, internal_requisition_number, public_title, profession_id, specialty_id, employment_type, status, workflow_id, created_by, created_at, published_at, professions(name), specialties(name), onboarding_flows!workflow_id(name), job_applications(count)"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.professionId) query = query.eq("profession_id", filters.professionId);
  if (filters.employmentType) query = query.eq("employment_type", filters.employmentType);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listPublicJobs(
  supabase: DbClient,
  tenantId: string,
  filters: {
    query?: string;
    professionId?: string;
    specialtyId?: string;
    location?: string;
    employmentType?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 12));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("job_requisitions")
    .select(
      "id, public_job_token, public_title, public_description, location, schedule, employment_type, pay_rate_min, pay_rate_max, qualifications, responsibilities, benefits, application_deadline, published_at, profession_id, specialty_id, professions(name), specialties(name)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .not("workflow_id", "is", null)
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order("published_at", { ascending: false })
    .range(from, to);

  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%_,]/g, " ");
    query = query.or(
      `public_title.ilike.%${term}%,public_description.ilike.%${term}%,location.ilike.%${term}%`
    );
  }
  if (filters.professionId) query = query.eq("profession_id", filters.professionId);
  if (filters.specialtyId) query = query.eq("specialty_id", filters.specialtyId);
  if (filters.location?.trim()) query = query.ilike("location", `%${filters.location.trim()}%`);
  if (filters.employmentType) query = query.eq("employment_type", filters.employmentType);

  const { data, error, count } = await query;
  if (error) throw error;
  const jobs = (data ?? []).filter((job) =>
    Boolean(normalizeJobToken(job.public_job_token ? String(job.public_job_token) : null))
  );
  return { jobs, total: count ?? jobs.length, page, pageSize };
}

export async function getPublishedJobByToken(
  supabase: DbClient,
  tenantId: string,
  token: string
) {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select(
      "id, tenant_id, public_job_token, public_title, public_description, location, schedule, employment_type, pay_rate_min, pay_rate_max, qualifications, responsibilities, benefits, application_deadline, published_at, profession_id, specialty_id, workflow_id, professions(name), specialties(name)"
    )
    .eq("tenant_id", tenantId)
    .eq("public_job_token", token)
    .eq("status", "published")
    .not("workflow_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || !isJobRequisitionOpen(data)) return null;
  return data;
}

type StartApplicationInput = {
  tenantId: string;
  jobToken: string;
  applicantAuthUserId: string;
  workerId?: string | null;
  email?: string | null;
};

export async function startOrResumeJobApplication(
  supabase: DbClient,
  input: StartApplicationInput
) {
  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select(
      "id, tenant_id, workflow_id, status, onboarding_flows!workflow_id!inner(id, name, status, builder_draft, updated_at)"
    )
    .eq("tenant_id", input.tenantId)
    .eq("public_job_token", input.jobToken)
    .eq("status", "published")
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job?.workflow_id) {
    throw new JobValidationError(
      "This job is unavailable or no longer accepting applications.",
      {},
      "JOB_UNAVAILABLE"
    );
  }

  const flow = Array.isArray(job.onboarding_flows)
    ? job.onboarding_flows[0]
    : job.onboarding_flows;
  if (!flow || flow.status !== "published") {
    throw new JobValidationError(
      "This job's onboarding workflow is unavailable.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }

  const normalizedEmail = input.email ? normalizeApplicantEmail(input.email) : null;
  let profileQuery = supabase
    .from("applicant_profiles")
    .select("id")
    .eq("tenant_id", input.tenantId);
  profileQuery = normalizedEmail
    ? profileQuery.eq("normalized_email", normalizedEmail)
    : profileQuery.eq("auth_user_id", input.applicantAuthUserId);
  const { data: existingProfile, error: profileLookupError } = await profileQuery.maybeSingle();
  if (profileLookupError) throw profileLookupError;

  let profileId = existingProfile?.id ? String(existingProfile.id) : null;
  if (!profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("applicant_profiles")
      .insert({
        tenant_id: input.tenantId,
        auth_user_id: input.applicantAuthUserId,
        worker_id: input.workerId ?? null,
        email: input.email?.trim() || null,
        normalized_email: normalizedEmail,
      })
      .select("id")
      .single();
    if (profileError) throw profileError;
    profileId = String(profile.id);
  } else {
    const { error: profileUpdateError } = await supabase
      .from("applicant_profiles")
      .update({
        auth_user_id: input.applicantAuthUserId,
        worker_id: input.workerId ?? undefined,
        email: input.email?.trim() || undefined,
        normalized_email: normalizedEmail ?? undefined,
      })
      .eq("id", profileId)
      .eq("tenant_id", input.tenantId);
    if (profileUpdateError) throw profileUpdateError;
  }

  const { data: existingApplication, error: existingError } = await supabase
    .from("job_applications")
    .select("id, applicant_workflow_instance_id, status")
    .eq("tenant_id", input.tenantId)
    .eq("job_requisition_id", job.id)
    .eq("applicant_profile_id", profileId)
    .neq("status", "withdrawn")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingApplication) {
    return { application: existingApplication, resumed: true };
  }

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .insert({
      tenant_id: input.tenantId,
      job_requisition_id: job.id,
      applicant_profile_id: profileId,
      applicant_auth_user_id: input.applicantAuthUserId,
      worker_id: input.workerId ?? null,
      workflow_id: job.workflow_id,
    })
    .select("id, status")
    .single();
  if (applicationError) throw applicationError;

  const snapshot = flow.builder_draft ?? { nodes: [], edges: [] };
  const workflowVersion = String(flow.updated_at ?? new Date().toISOString());
  const { data: instance, error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .insert({
      tenant_id: input.tenantId,
      application_id: application.id,
      workflow_id: job.workflow_id,
      workflow_name: flow.name,
      workflow_snapshot: snapshot,
      workflow_version: workflowVersion,
    })
    .select("id")
    .single();
  if (instanceError) {
    await supabase.from("job_applications").delete().eq("id", application.id);
    throw instanceError;
  }

  const nodes = Array.isArray((snapshot as { nodes?: unknown[] }).nodes)
    ? ((snapshot as { nodes: Array<Record<string, unknown>> }).nodes ?? [])
    : [];
  if (nodes.length) {
    const stepRows = nodes.map((node, index) => {
      const settings =
        node.settings && typeof node.settings === "object"
          ? (node.settings as Record<string, unknown>)
          : {};
      const phase =
        typeof settings.phase === "string"
          ? settings.phase
          : typeof node.phase === "string"
            ? node.phase
            : "pre_hire";
      return {
        tenant_id: input.tenantId,
        workflow_instance_id: instance.id,
        snapshot_step_id: String(node.id ?? `step-${index + 1}`),
        position: index + 1,
        title: String(node.label ?? `Step ${index + 1}`),
        step_type: String(node.stepId ?? "custom"),
        is_required: node.required === true,
        settings: { ...settings, phase },
      };
    });
    const { error: stepsError } = await supabase
      .from("applicant_workflow_step_records")
      .insert(stepRows);
    if (stepsError) throw stepsError;
  }

  const { data: linked, error: linkError } = await supabase
    .from("job_applications")
    .update({ applicant_workflow_instance_id: instance.id })
    .eq("id", application.id)
    .eq("tenant_id", input.tenantId)
    .select("id, applicant_workflow_instance_id, status")
    .single();
  if (linkError) throw linkError;

  return { application: linked, resumed: false };
}
