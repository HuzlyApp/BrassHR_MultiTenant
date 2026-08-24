import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  JobValidationError,
  type EmploymentType,
  type JobRequisitionInput,
  type JobStatus,
  type JobWorkflowAssignmentOptions,
  type SourceType,
  type WorkflowAssignmentMode,
  type WorkflowMatch,
} from "@/lib/jobs/types";
import {
  normalizeApplicantEmail,
  validatePublishableJob,
  workflowNoMatchMessage,
} from "@/lib/jobs/validation";
import { isStrongAiMatchScore } from "@/lib/jobs/match-analysis/display";
import { normalizeApplicationStatus } from "@/lib/jobs/application-status";
import {
  formatDateOnlyUtc,
  isJobRequisitionOpen,
  normalizeJobToken,
} from "@/lib/jobs/public-application-routing";
import {
  deriveEorType,
  isMspRecruitAndRelease,
  jobRequiresWorkflow,
  placementTypeFromApiRow,
  resolvePlacementTypeForSource,
} from "@/lib/jobs/placement";
import { normalizeJobRequisitionStatus } from "@/lib/jobs/job-status";
import { resolveWorkflowMatch } from "@/lib/workflow-mappings/service";
import { ensureAdminCandidateWorker } from "@/lib/jobs/ensure-admin-candidate-worker";
import { getOnboardingFlowById } from "@/lib/onboarding/onboarding-flows";
import {
  jobScreeningQuestionToInput,
  loadJobScreeningQuestions,
  syncJobScreeningQuestions,
  type JobScreeningQuestionInput,
} from "@/lib/jobs/screening-questions";
import { loadStaffUsersByIds } from "@/lib/account/resolve-staff-users";

type DbClient = SupabaseClient;

export { resolveWorkflowMatch };

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** DB check: rate_unit IN ('Hour','Day','Week','Month','Year','Flat') */
function toLegacyRateUnit(
  payRatePeriod?: string | null,
  compensationType?: string | null
): "Hour" | "Day" | "Week" | "Month" | "Year" | "Flat" | null {
  const period = (payRatePeriod ?? "").trim().toLowerCase();
  if (period.includes("hour")) return "Hour";
  if (period.includes("day")) return "Day";
  if (period.includes("week")) return "Week";
  if (period.includes("month")) return "Month";
  if (period.includes("year") || period.includes("annual")) return "Year";
  if (period.includes("flat")) return "Flat";

  const compensation = (compensationType ?? "").trim().toLowerCase();
  if (compensation.includes("hour")) return "Hour";
  if (compensation.includes("week")) return "Week";
  if (compensation.includes("month")) return "Month";
  if (compensation.includes("annual") || compensation.includes("year")) return "Year";

  return null;
}

function toJobRow(input: JobRequisitionInput) {
  const publicTitle = clean(input.publicTitle);
  const sourceJobTitle = clean(input.sourceJobTitle);
  /** MSP: Job Title and Source Job Title are the same field — prefer source title. */
  const resolvedPublicTitle =
    input.sourceType === "MSP"
      ? sourceJobTitle ?? publicTitle
      : publicTitle;
  const publicDescription = clean(input.publicDescription);
  const facility = clean(input.facility);
  const duration = clean(input.duration);
  const benefits = clean(input.benefits);
  const mspClient = clean(input.mspClient);
  const externalRequisitionId = clean(input.externalRequisitionId);
  const jobLocationType = clean(input.jobLocationType) ?? clean(input.schedule);
  const payRatePeriod = clean(input.payRatePeriod);
  const compensationType = clean(input.compensationType);
  const yearsOfExperience = clean(input.yearsOfExperience);
  const additionalLocations = Array.isArray(input.additionalLocations)
    ? input.additionalLocations.map((item) => item.trim()).filter(Boolean)
    : [];
  const yearsExperienceRequired = yearsOfExperience
    ? Number.parseInt(yearsOfExperience.replace(/[^\d]/g, ""), 10)
    : null;
  const requiredCredentials = clean(input.requiredCredentials);
  const suggestedPayRate =
    input.suggestedPayRate ?? input.payRateMin ?? input.payRateMax ?? null;
  const professionId = clean(input.professionId);
  /** MSP Location field writes facility; mirror into location for public/list display. */
  const location =
    clean(input.location) ?? (input.sourceType === "MSP" ? facility : null);

  return {
    internal_requisition_number: clean(input.internalRequisitionNumber),
    external_requisition_id: externalRequisitionId,
    source_type: input.sourceType,
    msp_client: mspClient,
    msp_name: clean(input.mspName),
    msp_client_name: mspClient,
    profession_id: professionId,
    specialty_id: clean(input.specialtyId),
    employment_type: input.employmentType,
    employer_of_record: clean(input.employerOfRecord),
    department: clean(input.department),
    facility,
    bill_rate: input.billRate ?? null,
    pay_rate_min: input.payRateMin ?? null,
    pay_rate_max: input.payRateMax ?? null,
    commission_percent: input.commissionPercent ?? null,
    commission_fixed_amount: input.commissionFixedAmount ?? null,
    target_start_date: clean(input.targetStartDate),
    duration,
    shift_type: clean(input.shiftType),
    shift_details: clean(input.shiftDetails),
    hours_per_week: input.hoursPerWeek ?? null,
    public_title: resolvedPublicTitle,
    public_description: publicDescription,
    location,
    schedule: jobLocationType,
    qualifications: clean(input.qualifications),
    responsibilities: clean(input.responsibilities),
    benefits,
    application_deadline: clean(input.applicationDeadline),
    positions_count: Math.max(1, Math.trunc(input.numberOfPositions ?? 1)),
    years_of_experience: yearsOfExperience,
    years_experience_required: Number.isFinite(yearsExperienceRequired)
      ? yearsExperienceRequired
      : null,
    additional_locations: additionalLocations,
    show_in_multiple_areas: Boolean(input.showInMultipleAreas),
    location_type: jobLocationType,
    acceptable_match_rate: clean(input.acceptableMatchRate),
    is_employer_on_record:
      typeof input.isEmployerOnRecord === "boolean" ? input.isEmployerOnRecord : true,
    compensation_type: compensationType,
    currency: clean(input.currency) ?? "USD",
    show_pay_by: clean(input.showPayBy),
    pay_rate_period: payRatePeriod,
    rate_unit: toLegacyRateUnit(payRatePeriod, compensationType),
    source_job_title: input.sourceType === "MSP" ? sourceJobTitle ?? resolvedPublicTitle : null,
    source_job_url: clean(input.sourceJobUrl),
    source_job_details: clean(input.sourceJobDetails),
    special_requirements: clean(input.specialRequirements),
    internal_notes: clean(input.internalNotes),
    required_credentials: requiredCredentials
      ? requiredCredentials
          .split(/[\n,]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    // Legacy columns still required on upgraded job_requisitions tables.
    title: resolvedPublicTitle ?? "Untitled job",
    description: publicDescription,
    placement_type:
      input.placementType ??
      (input.sourceType === "MSP" ? "Recruit_and_Release" : "Internal"),
    eor_type: deriveEorType(input),
    external_req_id: externalRequisitionId,
    facility_name: facility,
    job_duration: duration,
    benefits_summary: benefits,
    pay_rate: suggestedPayRate,
  };
}

type JobDbRow = ReturnType<typeof toJobRow> & { eor_tenant_id?: string | null };

/** MSP Recruit & EOR (tenant EOR) requires eor_tenant_id — enforced by DB check constraint. */
function applyTenantEorRowFields(
  row: ReturnType<typeof toJobRow>,
  tenantId: string,
  tenantName: string | null
): JobDbRow {
  if (row.placement_type !== "Recruit_and_EOR" || row.eor_type !== "Tenant") {
    return row;
  }

  return {
    ...row,
    eor_tenant_id: tenantId,
    is_employer_on_record: true,
    employer_of_record: row.employer_of_record ?? tenantName,
  };
}

async function resolveTenantName(
  supabase: DbClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data?.name ? String(data.name).trim() : null;
}


function cleanMatchText(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || "";
}

async function routingKeyChanged(
  supabase: DbClient,
  tenantId: string,
  jobId: string,
  input: JobRequisitionInput
): Promise<boolean> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select(
      "profession_id, specialty_id, employment_type, location, location_type, years_of_experience"
    )
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const nextLocationType = cleanMatchText(input.jobLocationType ?? input.schedule);
  return (
    String(data.profession_id ?? "") !== String(input.professionId ?? "") ||
    String(data.specialty_id ?? "") !== String(input.specialtyId ?? "") ||
    String(data.employment_type) !== input.employmentType ||
    cleanMatchText(data.location as string | null) !== cleanMatchText(input.location) ||
    cleanMatchText(data.location_type as string | null) !== nextLocationType ||
    cleanMatchText(data.years_of_experience as string | null) !==
      cleanMatchText(input.yearsOfExperience)
  );
}

async function loadExistingWorkflowAssignment(
  supabase: DbClient,
  tenantId: string,
  jobId: string
): Promise<{
  workflowId: string | null;
  assignmentMode: WorkflowAssignmentMode;
  mappingId: string | null;
} | null> {
  const { data, error } = await supabase
    .from("job_requisitions")
    .select("workflow_id, workflow_assignment_mode, workflow_mapping_id")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("workflow_assignment_mode") || message.includes("does not exist")) {
      const legacy = await supabase
        .from("job_requisitions")
        .select("workflow_id")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (legacy.error) throw legacy.error;
      if (!legacy.data) return null;
      return {
        workflowId: legacy.data.workflow_id ? String(legacy.data.workflow_id) : null,
        assignmentMode: "automatic",
        mappingId: null,
      };
    }
    throw error;
  }
  if (!data) return null;
  return {
    workflowId: data.workflow_id ? String(data.workflow_id) : null,
    assignmentMode:
      data.workflow_assignment_mode === "manual" ? "manual" : "automatic",
    mappingId: data.workflow_mapping_id ? String(data.workflow_mapping_id) : null,
  };
}

async function resolveManualOverrideMatch(
  supabase: DbClient,
  tenantId: string,
  workflowId: string
): Promise<WorkflowMatch> {
  const flow = await getOnboardingFlowById(supabase, tenantId, workflowId);
  if (!flow || flow.status !== "published") {
    throw new JobValidationError(
      "Select a published workflow to override the automatic assignment.",
      { workflowId: "Published workflow is required." },
      "WORKFLOW_OVERRIDE_INVALID"
    );
  }
  return {
    mappingId: null,
    workflowId: flow.id,
    workflowName: flow.name,
    source: "manual",
    specificity: 0,
    criteriaLabel: "Manual override",
  };
}

async function resolveJobWorkflowAssignment(
  supabase: DbClient,
  tenantId: string,
  input: JobRequisitionInput,
  options: {
    jobId?: string;
    resetToAutomatic?: boolean;
    overrideWorkflowId?: string | null;
  }
): Promise<{
  match: WorkflowMatch | null;
  assignmentMode: WorkflowAssignmentMode;
  assignmentError: string | null;
}> {
  const existing = options.jobId
    ? await loadExistingWorkflowAssignment(supabase, tenantId, options.jobId)
    : null;

  const overrideId = options.overrideWorkflowId?.trim() || null;
  if (overrideId) {
    const match = await resolveManualOverrideMatch(supabase, tenantId, overrideId);
    return { match, assignmentMode: "manual", assignmentError: null };
  }

  const keepManual =
    !options.resetToAutomatic &&
    existing?.assignmentMode === "manual" &&
    Boolean(existing.workflowId);

  if (keepManual && existing?.workflowId) {
    const match = await resolveManualOverrideMatch(supabase, tenantId, existing.workflowId);
    return { match, assignmentMode: "manual", assignmentError: null };
  }

  const match = await resolveWorkflowMatch(supabase, tenantId, {
    professionId: input.professionId,
    specialtyId: input.specialtyId,
    employmentType: input.employmentType,
    location: input.location,
    locationType: input.jobLocationType,
    jobLocationType: input.jobLocationType,
    yearsOfExperience: input.yearsOfExperience,
  });

  if (!match) {
    const name = await professionName(supabase, tenantId, input.professionId ?? "");
    return {
      match: null,
      assignmentMode: "automatic",
      assignmentError: workflowNoMatchMessage(name, {
        employmentType: input.employmentType,
        specialtyId: input.specialtyId,
        location: input.location,
        jobLocationType: input.jobLocationType,
        yearsOfExperience: input.yearsOfExperience,
      }),
    };
  }

  return { match, assignmentMode: "automatic", assignmentError: null };
}

/** Load the published onboarding flow assigned to a job (for new applicants). */
export async function resolvePublishedFlowForJobWorkflow(
  supabase: DbClient,
  tenantId: string,
  workflowId: string
) {
  const flow = await getOnboardingFlowById(supabase, tenantId, workflowId);
  if (!flow) {
    throw new JobValidationError(
      "The workflow assigned to this job is unavailable.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  if (flow.status !== "published") {
    throw new JobValidationError(
      "The workflow assigned to this job is not published.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  if (!flow.builderDraft || !Array.isArray(flow.builderDraft.nodes) || !flow.builderDraft.nodes.length) {
    throw new JobValidationError(
      "The workflow assigned to this job has no applicant steps.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }
  return flow;
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
  if (jobRequiresWorkflow(input) && !match) {
    message = workflowNoMatchMessage(
      await professionName(supabase, tenantId, input.professionId ?? ""),
      {
        employmentType: input.employmentType,
      }
    );
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
  options: {
    jobId?: string;
    publish: boolean;
    confirmRoutingChange?: boolean;
    screeningQuestions?: JobScreeningQuestionInput[];
  } & JobWorkflowAssignmentOptions
) {
  if (options.jobId) {
    const { data: existingJob, error: existingJobError } = await supabase
      .from("job_requisitions")
      .select("status, workflow_assignment_mode")
      .eq("id", options.jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (existingJobError) {
      const message = String(existingJobError.message ?? "").toLowerCase();
      if (!message.includes("workflow_assignment_mode") && !message.includes("does not exist")) {
        throw existingJobError;
      }
    }

    if (existingJob?.status === "published") {
      const routingChanged = await routingKeyChanged(supabase, tenantId, options.jobId, input);
      const isManual = existingJob?.workflow_assignment_mode === "manual";
      if (routingChanged && !isManual && !options.resetToAutomatic) {
        const applicantCount = await countActiveApplicantsForJob(
          supabase,
          tenantId,
          options.jobId
        );
        if (applicantCount > 0 && !options.confirmRoutingChange) {
          throw new JobValidationError(
            "Changing job attributes will assign a different workflow for new applicants. Existing applicants remain on their original workflow. Confirm to continue.",
            { professionId: "Confirm routing change to update workflow assignment." },
            "ROUTING_CHANGE_CONFIRMATION_REQUIRED"
          );
        }
      }
    }
  }

  const { match, assignmentMode, assignmentError } = await resolveJobWorkflowAssignment(
    supabase,
    tenantId,
    input,
    options
  );
  if (options.publish) await requirePublishable(supabase, tenantId, input, match);

  const baseRow = toJobRow(input);
  const tenantName =
    baseRow.placement_type === "Recruit_and_EOR" && baseRow.eor_type === "Tenant"
      ? await resolveTenantName(supabase, tenantId)
      : null;
  const jobRow = applyTenantEorRowFields(baseRow, tenantId, tenantName);

  const now = new Date().toISOString();
  const publicJobToken = options.publish
    ? await resolvePublicJobTokenForPublish(supabase, tenantId, options.jobId)
    : undefined;
  const patch = {
    ...jobRow,
    workflow_id: match?.workflowId ?? null,
    workflow_mapping_id: assignmentMode === "automatic" ? match?.mappingId ?? null : null,
    workflow_assignment_mode: assignmentMode,
    workflow_assignment_error: match ? null : assignmentError,
    status: options.publish ? ("published" as const) : ("draft" as const),
    published_at: options.publish ? now : null,
    closed_at: null,
    archived_at: null,
    updated_by: actorUserId,
    ...(publicJobToken ? { public_job_token: publicJobToken } : {}),
  };

  const selectCols =
    "*, professions(name), specialties(name), onboarding_flows!workflow_id(name)";

  if (options.jobId) {
    let { data, error } = await supabase
      .from("job_requisitions")
      .update(patch)
      .eq("id", options.jobId)
      .eq("tenant_id", tenantId)
      .select(selectCols)
      .single();

    if (error) {
      const message = String(error.message ?? "").toLowerCase();
      if (
        message.includes("workflow_assignment_mode") ||
        message.includes("workflow_mapping_id") ||
        message.includes("does not exist")
      ) {
        const legacyPatch = {
          ...applyTenantEorRowFields(toJobRow(input), tenantId, tenantName),
          workflow_id: match?.workflowId ?? null,
          status: options.publish ? ("published" as const) : ("draft" as const),
          published_at: options.publish ? now : null,
          closed_at: null,
          archived_at: null,
          updated_by: actorUserId,
          ...(publicJobToken ? { public_job_token: publicJobToken } : {}),
        };
        const retry = await supabase
          .from("job_requisitions")
          .update(legacyPatch)
          .eq("id", options.jobId)
          .eq("tenant_id", tenantId)
          .select(selectCols)
          .single();
        data = retry.data;
        error = retry.error;
      }
    }
    if (error) throw error;
    const savedJobId = String(data.id);
    const screeningQuestions =
      options.screeningQuestions !== undefined
        ? await syncJobScreeningQuestions(supabase, {
            tenantId,
            jobId: savedJobId,
            actorUserId,
            questions: options.screeningQuestions,
          })
        : await loadJobScreeningQuestions(supabase, tenantId, savedJobId);
    return {
      job: data,
      workflow: match,
      screeningQuestions: screeningQuestions.map(jobScreeningQuestionToInput),
    };
  }

  let { data, error } = await supabase
    .from("job_requisitions")
    .insert({
      ...patch,
      tenant_id: tenantId,
      created_by: actorUserId,
    })
    .select(selectCols)
    .single();

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (
      message.includes("workflow_assignment_mode") ||
      message.includes("workflow_mapping_id") ||
      message.includes("does not exist")
    ) {
      const legacyPatch = {
        ...applyTenantEorRowFields(toJobRow(input), tenantId, tenantName),
        workflow_id: match?.workflowId ?? null,
        status: options.publish ? ("published" as const) : ("draft" as const),
        published_at: options.publish ? now : null,
        closed_at: null,
        archived_at: null,
        updated_by: actorUserId,
        ...(publicJobToken ? { public_job_token: publicJobToken } : {}),
      };
      const retry = await supabase
        .from("job_requisitions")
        .insert({
          ...legacyPatch,
          tenant_id: tenantId,
          created_by: actorUserId,
        })
        .select(selectCols)
        .single();
      data = retry.data;
      error = retry.error;
    }
  }
  if (error) throw error;
  const savedJobId = String(data.id);
  const screeningQuestions =
    options.screeningQuestions !== undefined
      ? await syncJobScreeningQuestions(supabase, {
          tenantId,
          jobId: savedJobId,
          actorUserId,
          questions: options.screeningQuestions,
        })
      : [];
  return {
    job: data,
    workflow: match,
    screeningQuestions: screeningQuestions.map(jobScreeningQuestionToInput),
  };
}

export async function transitionJobStatus(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  jobId: string,
  status: Exclude<JobStatus, "published">
) {
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = {
    status,
    updated_by: actorUserId,
  };

  if (status === "draft") {
    patch.published_at = null;
    patch.closed_at = null;
    patch.archived_at = null;
  } else if (status === "closed") {
    patch.closed_at = now;
    patch.archived_at = null;
  } else if (status === "archived") {
    patch.archived_at = now;
    patch.closed_at = null;
    patch.published_at = null;
  }

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

/** Restore an archived job to draft (off public board, editable). */
export async function unarchiveJobRequisition(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  jobId: string
) {
  const { data: row, error } = await supabase
    .from("job_requisitions")
    .select("id, status")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new JobValidationError("Job not found.", {}, "JOB_NOT_FOUND");
  if (normalizeJobRequisitionStatus(String(row.status ?? "")) !== "archived") {
    throw new JobValidationError("Job is not archived.", {}, "JOB_NOT_ARCHIVED");
  }
  return transitionJobStatus(supabase, tenantId, actorUserId, jobId, "draft");
}

/** Close published jobs whose application deadline has passed. */
export async function closeExpiredPublishedJobs(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string
): Promise<void> {
  const today = formatDateOnlyUtc(new Date());
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("job_requisitions")
    .update({
      status: "closed",
      closed_at: now,
      updated_by: actorUserId,
    })
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .not("application_deadline", "is", null)
    .lt("application_deadline", today);
  if (error) throw error;
}

function jobRowToInput(row: Record<string, unknown>): JobRequisitionInput {
  const additionalRaw = row.additional_locations;
  const additionalLocations = Array.isArray(additionalRaw)
    ? additionalRaw.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  return {
    internalRequisitionNumber: row.internal_requisition_number
      ? String(row.internal_requisition_number)
      : null,
    externalRequisitionId: row.external_requisition_id ? String(row.external_requisition_id) : null,
    sourceType: (row.source_type as SourceType) || "Internal",
    placementType: placementTypeFromApiRow(
      (row.source_type as SourceType) || "Internal",
      row.placement_type,
      row.employment_type
    ),
    eorType:
      row.eor_type === "Tenant" || row.eor_type === "MSP" ? row.eor_type : null,
    mspClient: row.msp_client ? String(row.msp_client) : null,
    professionId: String(row.profession_id ?? ""),
    specialtyId: row.specialty_id ? String(row.specialty_id) : null,
    employmentType: (row.employment_type as EmploymentType) || "W2",
    employerOfRecord: row.employer_of_record ? String(row.employer_of_record) : null,
    department: row.department ? String(row.department) : null,
    facility: row.facility ? String(row.facility) : null,
    billRate: row.bill_rate == null ? null : Number(row.bill_rate),
    commissionPercent:
      row.commission_percent == null ? null : Number(row.commission_percent),
    commissionFixedAmount:
      row.commission_fixed_amount == null ? null : Number(row.commission_fixed_amount),
    payRateMin: row.pay_rate_min == null ? null : Number(row.pay_rate_min),
    payRateMax: row.pay_rate_max == null ? null : Number(row.pay_rate_max),
    targetStartDate: row.target_start_date ? String(row.target_start_date) : null,
    duration: row.duration ? String(row.duration) : null,
    shiftType: row.shift_type ? String(row.shift_type) : null,
    shiftDetails: row.shift_details ? String(row.shift_details) : null,
    hoursPerWeek: row.hours_per_week == null ? null : Number(row.hours_per_week),
    publicTitle: row.public_title ? String(row.public_title) : null,
    publicDescription: row.public_description ? String(row.public_description) : null,
    location: row.location ? String(row.location) : null,
    schedule: row.schedule ? String(row.schedule) : null,
    qualifications: row.qualifications ? String(row.qualifications) : null,
    responsibilities: row.responsibilities ? String(row.responsibilities) : null,
    benefits: row.benefits ? String(row.benefits) : null,
    applicationDeadline: row.application_deadline ? String(row.application_deadline) : null,
    numberOfPositions:
      row.positions_count == null ? 1 : Math.max(1, Number(row.positions_count) || 1),
    yearsOfExperience: row.years_of_experience
      ? String(row.years_of_experience)
      : row.years_experience_required != null
        ? `${row.years_experience_required} yrs`
        : null,
    additionalLocations,
    showInMultipleAreas: Boolean(row.show_in_multiple_areas),
    jobLocationType: row.location_type
      ? String(row.location_type)
      : row.schedule
        ? String(row.schedule)
        : null,
    acceptableMatchRate: row.acceptable_match_rate ? String(row.acceptable_match_rate) : null,
    isEmployerOnRecord:
      typeof row.is_employer_on_record === "boolean" ? row.is_employer_on_record : true,
    compensationType: row.compensation_type ? String(row.compensation_type) : null,
    currency: row.currency ? String(row.currency) : null,
    showPayBy: row.show_pay_by ? String(row.show_pay_by) : null,
    payRatePeriod: row.pay_rate_period
      ? String(row.pay_rate_period)
      : row.rate_unit
        ? String(row.rate_unit)
        : null,
    mspName: row.msp_name ? String(row.msp_name) : null,
    sourceJobTitle: row.source_job_title ? String(row.source_job_title) : null,
    sourceJobUrl: row.source_job_url ? String(row.source_job_url) : null,
    sourceJobDetails: row.source_job_details ? String(row.source_job_details) : null,
    suggestedPayRate: row.pay_rate == null ? null : Number(row.pay_rate),
    requiredCredentials: Array.isArray(row.required_credentials)
      ? row.required_credentials.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ")
      : row.required_credentials
        ? String(row.required_credentials)
        : null,
    specialRequirements: row.special_requirements ? String(row.special_requirements) : null,
    internalNotes: row.internal_notes ? String(row.internal_notes) : null,
  };
}

/** Publish an existing draft/closed job from the list actions menu. */
export async function publishExistingJob(
  supabase: DbClient,
  tenantId: string,
  actorUserId: string,
  jobId: string
) {
  const { data: row, error } = await supabase
    .from("job_requisitions")
    .select("*")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new JobValidationError("Job not found.", {}, "JOB_NOT_FOUND");

  const status = String(row.status ?? "");
  if (normalizeJobRequisitionStatus(status) === "published") {
    throw new JobValidationError("Job is already published.", {}, "JOB_ALREADY_PUBLISHED");
  }
  if (normalizeJobRequisitionStatus(status) === "archived") {
    throw new JobValidationError("Unarchive the job before publishing.", {}, "JOB_ARCHIVED");
  }

  if (
    !isJobRequisitionOpen({
      application_deadline: row.application_deadline ? String(row.application_deadline) : null,
    })
  ) {
    throw new JobValidationError(
      "Update the application deadline before republishing this job.",
      { applicationDeadline: "Application deadline has passed." },
      "JOB_DEADLINE_EXPIRED"
    );
  }

  const result = await saveJobRequisition(
    supabase,
    tenantId,
    actorUserId,
    jobRowToInput(row as Record<string, unknown>),
    { jobId, publish: true }
  );
  return result.job;
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
      "id, internal_requisition_number, public_title, public_job_token, profession_id, specialty_id, employment_type, source_type, placement_type, msp_name, msp_client, source_job_title, status, workflow_id, created_by, created_at, published_at, location, facility, facility_name, application_deadline, location_type, schedule, shift_type, pay_rate_min, pay_rate_max, pay_rate_period, rate_unit, pay_rate, commission_percent, commission_fixed_amount, professions(name), specialties(name), onboarding_flows!workflow_id(name), job_applications!job_requisition_id(count)"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.professionId) query = query.eq("profession_id", filters.professionId);
  if (filters.employmentType) query = query.eq("employment_type", filters.employmentType);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);

  const { data, error } = await query;
  if (error) throw error;
  const jobs = data ?? [];
  if (!jobs.length) return jobs;

  const jobIds = jobs.map((job) => String(job.id));
  const { data: applicationRows, error: applicationError } = await supabase
    .from("job_applications")
    .select(
      "job_requisition_id, status, ai_match_status, ai_match_score, ai_match_readiness, ai_analyzed_at"
    )
    .eq("tenant_id", tenantId)
    .in("job_requisition_id", jobIds);
  if (applicationError) throw applicationError;

  type JobListMetricCounts = {
    newCount: number;
    analyzedCount: number;
    strongCount: number;
    readyCount: number;
    hiredCount: number;
  };
  const metricsByJob = new Map<string, JobListMetricCounts>();
  for (const row of applicationRows ?? []) {
    const id = String(row.job_requisition_id ?? "");
    if (!id) continue;
    const current = metricsByJob.get(id) ?? {
      newCount: 0,
      analyzedCount: 0,
      strongCount: 0,
      readyCount: 0,
      hiredCount: 0,
    };
    const status = String(row.status ?? "").toLowerCase();
    if (status === "new" || status === "submitted") current.newCount += 1;
    if (normalizeApplicationStatus(status) === "hired") current.hiredCount += 1;

    const matchStatus = String(row.ai_match_status ?? "");
    const score = Number(row.ai_match_score);
    const hasMatchScore = Number.isFinite(score);
    const analysisDone =
      matchStatus === "ANALYZED" || hasMatchScore || Boolean(row.ai_analyzed_at);

    if (analysisDone) current.analyzedCount += 1;
    if (isStrongAiMatchScore(row.ai_match_score)) current.strongCount += 1;
    if (analysisDone && String(row.ai_match_readiness ?? "") === "READY_TO_SUBMIT") {
      current.readyCount += 1;
    }
    metricsByJob.set(id, current);
  }

  const creatorIds = jobs
    .map((job) => (job as { created_by?: string | null }).created_by)
    .filter((id): id is string => Boolean(id));
  const creatorsById = await loadStaffUsersByIds(supabase, tenantId, creatorIds);

  return jobs.map((job) => {
    const metrics = metricsByJob.get(String(job.id));
    const createdByUserId = (job as { created_by?: string | null }).created_by;
    return {
      ...job,
      status: normalizeJobRequisitionStatus(String(job.status ?? "")),
      new_application_count: metrics?.newCount ?? 0,
      analyzed_application_count: metrics?.analyzedCount ?? 0,
      strong_match_count: metrics?.strongCount ?? 0,
      ready_to_submit_count: metrics?.readyCount ?? 0,
      hired_application_count: metrics?.hiredCount ?? 0,
      createdBy: createdByUserId
        ? creatorsById.get(String(createdByUserId)) ?? null
        : null,
    };
  });
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
      "id, public_job_token, public_title, source_job_title, source_type, public_description, location, schedule, employment_type, pay_rate_min, pay_rate_max, qualifications, responsibilities, benefits, application_deadline, published_at, profession_id, specialty_id, professions(name), specialties(name)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    // MSP jobs publish without workflow_id; still list them on the public board.
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order("published_at", { ascending: false })
    .range(from, to);

  if (filters.query?.trim()) {
    const term = filters.query.trim().replace(/[%_,]/g, " ");
    query = query.or(
      `public_title.ilike.%${term}%,source_job_title.ilike.%${term}%,public_description.ilike.%${term}%,location.ilike.%${term}%`
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
      "id, tenant_id, public_job_token, public_title, source_job_title, source_type, public_description, location, schedule, employment_type, pay_rate_min, pay_rate_max, qualifications, responsibilities, benefits, application_deadline, published_at, profession_id, specialty_id, workflow_id, professions(name), specialties(name)"
    )
    .eq("tenant_id", tenantId)
    .eq("public_job_token", token)
    .eq("status", "published")
    // MSP jobs are intentionally published without workflow_id; public detail still shows.
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
    .select("id, tenant_id, workflow_id, status")
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

  let assignedFlow;
  try {
    assignedFlow = await resolvePublishedFlowForJobWorkflow(
      supabase,
      input.tenantId,
      String(job.workflow_id)
    );
  } catch (error) {
    throw new JobValidationError(
      error instanceof Error
        ? error.message
        : "The workflow assigned to this job is unavailable.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }

  const workflowId = assignedFlow.id;
  const snapshot = assignedFlow.builderDraft ?? { nodes: [], edges: [] };
  const workflowVersion = String(assignedFlow.updatedAt ?? new Date().toISOString());
  const workflowName = String(assignedFlow.name ?? "Assigned Workflow");

  const normalizedEmail = input.email ? normalizeApplicantEmail(input.email) : null;

  // Resolve existing applicant_profiles by worker_id, auth_user_id, then email.
  // Looking up by email alone can miss an existing auth_user_id row and cause
  // applicant_profiles_tenant_auth_uidx on insert when applying to another job.
  let profileId: string | null = null;

  if (input.workerId) {
    const { data: byWorker, error: byWorkerError } = await supabase
      .from("applicant_profiles")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("worker_id", input.workerId)
      .maybeSingle();
    if (byWorkerError) throw byWorkerError;
    if (byWorker?.id) profileId = String(byWorker.id);
  }

  if (!profileId) {
    const { data: byAuth, error: byAuthError } = await supabase
      .from("applicant_profiles")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("auth_user_id", input.applicantAuthUserId)
      .maybeSingle();
    if (byAuthError) throw byAuthError;
    if (byAuth?.id) profileId = String(byAuth.id);
  }

  if (!profileId && normalizedEmail) {
    const { data: byEmail, error: byEmailError } = await supabase
      .from("applicant_profiles")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .eq("normalized_email", normalizedEmail)
      .maybeSingle();
    if (byEmailError) throw byEmailError;
    if (byEmail?.id) profileId = String(byEmail.id);
  }

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

    if (profileError) {
      const isDuplicate =
        profileError.code === "23505" ||
        /duplicate key|unique constraint/i.test(String(profileError.message ?? ""));
      if (!isDuplicate) throw profileError;

      const { data: racedByAuth } = await supabase
        .from("applicant_profiles")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("auth_user_id", input.applicantAuthUserId)
        .maybeSingle();
      if (racedByAuth?.id) {
        profileId = String(racedByAuth.id);
      } else if (input.workerId) {
        const { data: racedByWorker } = await supabase
          .from("applicant_profiles")
          .select("id")
          .eq("tenant_id", input.tenantId)
          .eq("worker_id", input.workerId)
          .maybeSingle();
        if (racedByWorker?.id) profileId = String(racedByWorker.id);
      }

      if (!profileId && normalizedEmail) {
        const { data: racedByEmail } = await supabase
          .from("applicant_profiles")
          .select("id")
          .eq("tenant_id", input.tenantId)
          .eq("normalized_email", normalizedEmail)
          .maybeSingle();
        if (racedByEmail?.id) profileId = String(racedByEmail.id);
      }

      if (!profileId) throw profileError;
    } else {
      profileId = String(profile.id);
    }
  }

  if (profileId) {
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

  if (!profileId) {
    throw new JobValidationError("Could not resolve applicant profile.", {}, "PROFILE_REQUIRED");
  }

  const { data: existingApplication, error: existingError } = await supabase
    .from("job_applications")
    .select("id, applicant_workflow_instance_id, status")
    .eq("tenant_id", input.tenantId)
    .eq("job_requisition_id", job.id)
    .eq("applicant_profile_id", profileId)
    .not("status", "in", '("rejected","withdrawn")')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingApplication) {
    return { application: existingApplication, resumed: true };
  }

  // Also check by worker_id when available (DB unique job_applications_worker_job_uidx)
  if (input.workerId) {
    const { data: byWorker, error: byWorkerError } = await supabase
      .from("job_applications")
      .select("id, applicant_workflow_instance_id, status")
      .eq("tenant_id", input.tenantId)
      .eq("job_requisition_id", job.id)
      .eq("worker_id", input.workerId)
      .not("status", "in", '("rejected","withdrawn")')
      .maybeSingle();
    if (byWorkerError) throw byWorkerError;
    if (byWorker) {
      return { application: byWorker, resumed: true };
    }
  }

  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .insert({
      tenant_id: input.tenantId,
      job_requisition_id: job.id,
      applicant_profile_id: profileId,
      applicant_auth_user_id: input.applicantAuthUserId,
      worker_id: input.workerId ?? null,
      workflow_id: workflowId,
    })
    .select("id, status")
    .single();

  if (applicationError) {
    // Concurrent duplicate apply: return existing active application
    const isDuplicate =
      applicationError.code === "23505" ||
      /duplicate key|unique constraint/i.test(String(applicationError.message ?? ""));
    if (isDuplicate) {
      const { data: raced } = await supabase
        .from("job_applications")
        .select("id, applicant_workflow_instance_id, status")
        .eq("tenant_id", input.tenantId)
        .eq("job_requisition_id", job.id)
        .eq("applicant_profile_id", profileId)
        .not("status", "in", '("rejected","withdrawn")')
        .maybeSingle();
      if (raced) return { application: raced, resumed: true };
    }
    throw applicationError;
  }

  // Prefer the job-application schema; include legacy columns when present on staging.
  const instancePayload = {
    tenant_id: input.tenantId,
    application_id: application.id,
    workflow_id: workflowId,
    worker_id: input.workerId ?? null,
    job_requisition_id: job.id,
    onboarding_flow_id: workflowId,
    workflow_name: workflowName,
    workflow_snapshot: snapshot,
    workflow_version: workflowVersion,
    status: "in_progress" as const,
  };

  let { data: instance, error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .insert(instancePayload)
    .select("id")
    .single();

  if (instanceError) {
    const message = String(instanceError.message ?? "");
    const unknownLegacyColumn = /onboarding_flow_id|job_requisition_id|Could not find/i.test(
      message
    );
    if (unknownLegacyColumn) {
      const retry = await supabase
        .from("applicant_workflow_instances")
        .insert({
          tenant_id: input.tenantId,
          application_id: application.id,
          workflow_id: workflowId,
          workflow_name: workflowName,
          workflow_snapshot: snapshot,
          workflow_version: workflowVersion,
          status: "in_progress",
        })
        .select("id")
        .single();
      instance = retry.data;
      instanceError = retry.error;
    }
  }

  if (instanceError || !instance?.id) {
    await supabase.from("job_applications").delete().eq("id", application.id);
    throw instanceError ?? new Error("Failed to create applicant workflow instance.");
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

function splitCandidateFullName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function attachWorkflowInstanceToApplication(
  supabase: DbClient,
  input: {
    tenantId: string;
    applicationId: string;
    jobRequisitionId: string;
    workflowId: string;
    workerId?: string | null;
    flow: { name?: string | null; builder_draft?: unknown; updated_at?: string | null };
  }
) {
  const snapshot = input.flow.builder_draft ?? { nodes: [], edges: [] };
  const workflowVersion = String(input.flow.updated_at ?? new Date().toISOString());
  const workflowName = String(input.flow.name ?? "Workflow");

  const instancePayload = {
    tenant_id: input.tenantId,
    application_id: input.applicationId,
    workflow_id: input.workflowId,
    worker_id: input.workerId ?? null,
    job_requisition_id: input.jobRequisitionId,
    onboarding_flow_id: input.workflowId,
    workflow_name: workflowName,
    workflow_snapshot: snapshot,
    workflow_version: workflowVersion,
    status: "in_progress" as const,
  };

  let { data: instance, error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .insert(instancePayload)
    .select("id")
    .single();

  if (instanceError) {
    const message = String(instanceError.message ?? "");
    const unknownLegacyColumn = /onboarding_flow_id|job_requisition_id|Could not find/i.test(
      message
    );
    if (unknownLegacyColumn) {
      const retry = await supabase
        .from("applicant_workflow_instances")
        .insert({
          tenant_id: input.tenantId,
          application_id: input.applicationId,
          workflow_id: input.workflowId,
          workflow_name: workflowName,
          workflow_snapshot: snapshot,
          workflow_version: workflowVersion,
          status: "in_progress",
        })
        .select("id")
        .single();
      instance = retry.data;
      instanceError = retry.error;
    }
  }

  if (instanceError || !instance?.id) {
    throw instanceError ?? new Error("Failed to create applicant workflow instance.");
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
    .eq("id", input.applicationId)
    .eq("tenant_id", input.tenantId)
    .select("id, applicant_workflow_instance_id, status, job_requisition_id, applicant_profile_id")
    .single();
  if (linkError) throw linkError;
  return linked;
}

export type CreateAdminCandidateInput = {
  tenantId: string;
  jobRequisitionId: string;
  name: string;
  email: string;
  phone?: string | null;
  streetAddress?: string | null;
  cityStateZip?: string | null;
  country?: string | null;
  lastJobTitle?: string | null;
  lastCompany?: string | null;
  createdByStaffUserId?: string | null;
  resumePath?: string | null;
  resumeFileName?: string | null;
};

/**
 * Admin "Add candidate": create/update applicant_profiles + job_applications (status new)
 * so the candidate appears in the job's candidates listing.
 */
export async function createAdminJobApplication(
  supabase: DbClient,
  input: CreateAdminCandidateInput
) {
  const email = input.email.trim();
  const normalizedEmail = normalizeApplicantEmail(email);
  const fullName = input.name.trim();
  if (!fullName) {
    throw new JobValidationError("Name is required.", { name: "Name is required." }, "NAME_REQUIRED");
  }
  if (!normalizedEmail) {
    throw new JobValidationError("Email is required.", { email: "Email is required." }, "EMAIL_REQUIRED");
  }

  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select("id, tenant_id, workflow_id, status, public_title")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.jobRequisitionId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job?.workflow_id) {
    throw new JobValidationError(
      "This job is unavailable or has no workflow assigned.",
      {},
      "JOB_UNAVAILABLE"
    );
  }
  if (String(job.status) !== "published") {
    throw new JobValidationError(
      "Only published jobs can accept candidates. Publish the job first.",
      {},
      "JOB_NOT_PUBLISHED"
    );
  }

  let assignedFlow;
  try {
    assignedFlow = await resolvePublishedFlowForJobWorkflow(
      supabase,
      input.tenantId,
      String(job.workflow_id)
    );
  } catch (error) {
    throw new JobValidationError(
      error instanceof Error
        ? error.message
        : "The workflow assigned to this job is unavailable.",
      {},
      "WORKFLOW_UNAVAILABLE"
    );
  }

  const workflowId = assignedFlow.id;

  const { firstName, lastName } = splitCandidateFullName(fullName);
  const profileFields = {
    email,
    normalized_email: normalizedEmail,
    first_name: firstName,
    last_name: lastName,
    phone: clean(input.phone),
    street_address: clean(input.streetAddress),
    city_state_zip: clean(input.cityStateZip),
    country: clean(input.country),
    last_job_title: clean(input.lastJobTitle),
    last_company: clean(input.lastCompany),
    resume_path: clean(input.resumePath),
    resume_file_name: clean(input.resumeFileName),
    updated_at: new Date().toISOString(),
  };

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("applicant_profiles")
    .select("id, worker_id")
    .eq("tenant_id", input.tenantId)
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;

  let profileId = existingProfile?.id ? String(existingProfile.id) : null;
  let linkedWorkerId = existingProfile?.worker_id ? String(existingProfile.worker_id) : null;
  if (!profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("applicant_profiles")
      .insert({
        tenant_id: input.tenantId,
        ...profileFields,
      })
      .select("id, worker_id")
      .single();
    if (profileError) throw profileError;
    profileId = String(profile.id);
    linkedWorkerId = profile.worker_id ? String(profile.worker_id) : null;
  } else {
    const { error: profileUpdateError } = await supabase
      .from("applicant_profiles")
      .update(profileFields)
      .eq("id", profileId)
      .eq("tenant_id", input.tenantId);
    if (profileUpdateError) throw profileUpdateError;
  }

  try {
    const linked = await ensureAdminCandidateWorker(supabase, {
      tenantId: input.tenantId,
      applicantProfileId: profileId,
      existingWorkerId: linkedWorkerId,
      email,
      firstName,
      lastName,
      phone: input.phone,
      streetAddress: input.streetAddress,
      cityStateZip: input.cityStateZip,
      lastJobTitle: input.lastJobTitle,
      resumePath: input.resumePath,
    });
    linkedWorkerId = linked.workerId;
  } catch (workerError) {
    throw new JobValidationError(
      workerError instanceof Error ? workerError.message : "Failed to link candidate profile",
      { email: workerError instanceof Error ? workerError.message : "Failed to link candidate profile" },
      "WORKER_LINK_FAILED"
    );
  }

  const { data: existingApplication, error: existingError } = await supabase
    .from("job_applications")
    .select("id, status, applicant_workflow_instance_id")
    .eq("tenant_id", input.tenantId)
    .eq("job_requisition_id", job.id)
    .eq("applicant_profile_id", profileId)
    .not("status", "in", '("rejected","withdrawn")')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingApplication) {
    throw new JobValidationError(
      "This candidate already has an application for this job.",
      { email: "A candidate with this email already applied for this job." },
      "DUPLICATE_APPLICATION"
    );
  }

  const nowIso = new Date().toISOString();
  const { data: application, error: applicationError } = await supabase
    .from("job_applications")
    .insert({
      tenant_id: input.tenantId,
      job_requisition_id: job.id,
      applicant_profile_id: profileId,
      workflow_id: workflowId,
      worker_id: linkedWorkerId,
      status: "new",
      submitted_at: nowIso,
      source: "admin",
      created_by_staff_user_id: input.createdByStaffUserId ?? null,
    })
    .select("id, status, job_requisition_id, applicant_profile_id, worker_id")
    .single();
  if (applicationError) throw applicationError;

  try {
    const linked = await attachWorkflowInstanceToApplication(supabase, {
      tenantId: input.tenantId,
      applicationId: String(application.id),
      jobRequisitionId: String(job.id),
      workflowId,
      workerId: linkedWorkerId,
      flow: {
        name: assignedFlow.name,
        builder_draft: assignedFlow.builderDraft,
        updated_at: assignedFlow.updatedAt,
      },
    });

    // Attach any worker-level requirements row to this application when still unscoped
    if (linkedWorkerId) {
      await supabase
        .from("worker_requirements")
        .update({ application_id: String(application.id), updated_at: nowIso })
        .eq("worker_id", linkedWorkerId)
        .eq("tenant_id", input.tenantId)
        .is("application_id", null);
    }

    return {
      application: linked,
      applicantProfileId: profileId,
      jobTitle: String(job.public_title ?? ""),
    };
  } catch (error) {
    await supabase.from("job_applications").delete().eq("id", application.id);
    throw error;
  }
}

const MAX_BULK_DELETE_COUNT = 100;

function normalizeBulkDeleteIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  return unique.slice(0, MAX_BULK_DELETE_COUNT);
}

export function parseBulkDeleteIds(ids: unknown): string[] {
  return normalizeBulkDeleteIds(ids);
}

export async function bulkDeleteJobApplications(
  supabase: DbClient,
  tenantId: string,
  ids: string[]
): Promise<{ deletedIds: string[] }> {
  const normalized = normalizeBulkDeleteIds(ids);
  if (!normalized.length) return { deletedIds: [] };

  const { data, error } = await supabase
    .from("job_applications")
    .delete()
    .in("id", normalized)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) throw error;
  return { deletedIds: (data ?? []).map((row) => String(row.id)) };
}

export async function bulkDeleteJobRequisitions(
  supabase: DbClient,
  tenantId: string,
  ids: string[]
): Promise<{ deletedIds: string[] }> {
  const normalized = normalizeBulkDeleteIds(ids);
  if (!normalized.length) return { deletedIds: [] };

  // Remove linked applications first so delete works even when the DB FK is still RESTRICT
  // (staging missed the ON DELETE CASCADE migration). Child rows cascade from applications.
  const { error: applicationsError } = await supabase
    .from("job_applications")
    .delete()
    .in("job_requisition_id", normalized)
    .eq("tenant_id", tenantId);

  if (applicationsError) throw applicationsError;

  const { data, error } = await supabase
    .from("job_requisitions")
    .delete()
    .in("id", normalized)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) throw error;
  return { deletedIds: (data ?? []).map((row) => String(row.id)) };
}
