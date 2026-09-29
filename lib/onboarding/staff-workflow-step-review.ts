import type { SupabaseClient } from "@supabase/supabase-js";
import { staffDisplayName } from "@/lib/account/resolve-staff-users";
import { writeActivityLog } from "@/lib/audit/activity-log";
import {
  buildApplicantEmailContext,
  contextToTemplateVariables,
} from "@/lib/email/applicant-email-context";
import { sendTemplatedEmail } from "@/lib/email/send-templated-email";
import { EMAIL_TEMPLATE_TYPE } from "@/lib/email-templates/template-keys";
import {
  POST_HIRE_NOT_AVAILABLE_CODE,
  POST_HIRE_NOT_AVAILABLE_MESSAGE,
  mapAssignedStepRecords,
  parseAssignedStepPhase,
  type AssignedStepRecordInput,
  type MappedAssignedStep,
  type ProgressRowInput,
} from "@/lib/onboarding/assigned-workflow-steps";
import { computeCandidateOnboardingFrontier } from "@/lib/onboarding/candidate-onboarding-projection";
import { buildProgressStatusMaps } from "@/lib/onboarding/compute-max-allowed-from-progress";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import { loadApplicantConfigForJobToken } from "@/lib/onboarding/load-config-for-job-workflow";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { canRevealPostHire } from "@/lib/onboarding/lock-post-hire";
import { loadApplicationWorkflowPhase } from "@/lib/onboarding/resolve-application-workflow-phase";
import { resolveInstanceApplicationId } from "@/lib/onboarding/scoped-step-progress";
import {
  allowedStaffActions,
  completionOwnerLabel,
  readStaffStepReview,
  staffActionTargetStatus,
  type StaffStepAction,
  type StaffStepActionEligibility,
  type StaffStepEmailResult,
  type StaffStepReview,
} from "@/lib/onboarding/staff-step-review-shared";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";
import type {
  OnboardingStepStatus,
  StepProgressRow,
  TenantOnboardingConfig,
  TenantOnboardingStep,
  WorkerOnboardingProgressPayload,
} from "@/lib/onboarding/types";
import type { EmploymentLifecyclePhase } from "@/lib/onboarding/workflow-phase-groups";
import {
  getWorkflowSettings,
  isApplicantCompletionOwner,
  isWorkerVisibleStep,
} from "@/lib/onboarding/workflow-settings";

const STAFF_REVIEW_HISTORY_LIMIT = 20;

export type StaffStepActionResult =
  | {
      ok: true;
      status: OnboardingStepStatus;
      review: StaffStepReview;
      email: StaffStepEmailResult | null;
    }
  | { ok: false; status: number; code?: string; error: string };

type StepFailure = { ok: false; status: number; code?: string; error: string };

export type StaffStepContext = {
  ok: true;
  record: Record<string, unknown>;
  instance: Record<string, unknown>;
  phase: EmploymentLifecyclePhase;
  mapped: MappedAssignedStep;
  tenantStep: TenantOnboardingStep | null;
  config: TenantOnboardingConfig | null;
  applicationId: string | null;
};

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toAssignedRecord(row: Record<string, unknown>): AssignedStepRecordInput {
  return {
    id: String(row.id),
    snapshot_step_id: String(row.snapshot_step_id ?? ""),
    title: String(row.title ?? "Step"),
    step_type: String(row.step_type ?? "custom-step"),
    is_required: row.is_required !== false,
    status: asText(row.status),
    position: typeof row.position === "number" ? row.position : 0,
    phase: asText(row.phase),
    settings: asObject(row.settings),
    completed_at: asText(row.completed_at),
    created_at: asText(row.created_at),
  };
}

const STEP_RECORD_SELECT =
  "id, tenant_id, workflow_instance_id, snapshot_step_id, title, step_type, is_required, status, position, phase, settings, completed_at, created_at";

/**
 * Maps every record in the instance (not just the target) so tenant-step matching
 * agrees with the Hire Journey list, which consumes candidates in position order.
 */
export async function mapInstanceStepRecord(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    instanceId: string;
    recordId: string;
    tenantSteps: TenantOnboardingStep[];
    progressByStepId: Map<string, ProgressRowInput>;
    assignedAt: string | null;
  }
): Promise<MappedAssignedStep | null> {
  const { data, error } = await supabase
    .from("applicant_workflow_step_records")
    .select(STEP_RECORD_SELECT)
    .eq("tenant_id", params.tenantId)
    .eq("workflow_instance_id", params.instanceId)
    .order("position", { ascending: true });
  if (error) throw error;
  const mapped = mapAssignedStepRecords({
    records: ((data ?? []) as Array<Record<string, unknown>>).map(toAssignedRecord),
    tenantSteps: params.tenantSteps,
    progressByStepId: params.progressByStepId,
    assignedAt: params.assignedAt,
  });
  return mapped.find((step) => step.id === params.recordId) ?? null;
}

export function resolveStaffStepEligibility(
  tenantStep: TenantOnboardingStep | null,
  currentStatus: OnboardingStepStatus | string | null | undefined
): StaffStepActionEligibility {
  if (!tenantStep) {
    return {
      allowed: false,
      ownerLabel: null,
      actions: [],
      reason: "This step isn't linked to a stored progress record, so it can't be updated here.",
    };
  }
  if (isWorkerVisibleStep(tenantStep)) {
    return {
      allowed: false,
      ownerLabel: "Candidate",
      actions: [],
      reason: "The candidate completes this step from their application portal.",
    };
  }
  const owner = getWorkflowSettings(tenantStep).completionOwner;
  return {
    allowed: true,
    ownerLabel: isApplicantCompletionOwner(owner) ? "Internal team" : completionOwnerLabel(owner),
    actions: allowedStaffActions(currentStatus),
    reason: null,
  };
}

export async function loadStaffStepContext(
  supabase: SupabaseClient,
  params: { workerId: string; tenantId: string; stepRecordId: string }
): Promise<StaffStepContext | StepFailure> {
  const { workerId, tenantId, stepRecordId } = params;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, status, converted_at, converted_worker_id, conversion_status")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;
  if (!worker) return { ok: false, status: 404, error: "Candidate not found" };

  const { data: record, error: recordError } = await supabase
    .from("applicant_workflow_step_records")
    .select(STEP_RECORD_SELECT)
    .eq("id", stepRecordId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (recordError) throw recordError;
  if (!record) return { ok: false, status: 404, error: "Workflow step not found" };

  const { data: instance, error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .select("id, worker_id, application_id, started_at, created_at, tenant_id")
    .eq("id", record.workflow_instance_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (instanceError) throw instanceError;
  if (!instance || asText(instance.worker_id) !== workerId) {
    return { ok: false, status: 404, error: "Workflow step not found" };
  }

  const phase = parseAssignedStepPhase({
    phase: asText(record.phase),
    settings: asObject(record.settings),
  });
  const postHireVisible = canRevealPostHire({
    workerStatus: asText(worker.status),
    convertedAt: asText(worker.converted_at),
    convertedWorkerId: asText(worker.converted_worker_id),
    conversionStatus: asText(worker.conversion_status),
  });
  if (phase === "post_hire" && !postHireVisible) {
    return {
      ok: false,
      status: 403,
      code: POST_HIRE_NOT_AVAILABLE_CODE,
      error: POST_HIRE_NOT_AVAILABLE_MESSAGE,
    };
  }

  const [config, applicationId] = await Promise.all([
    loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false }),
    resolveInstanceApplicationId(supabase, {
      tenantId,
      instanceId: String(instance.id),
      instanceApplicationId: asText(instance.application_id),
    }),
  ]);
  const tenantSteps = (config?.steps ?? []).filter((step) => step.is_enabled);

  const mapped = await mapInstanceStepRecord(supabase, {
    tenantId,
    instanceId: String(instance.id),
    recordId: String(record.id),
    tenantSteps,
    progressByStepId: new Map(),
    assignedAt: asText(instance.started_at) ?? asText(instance.created_at),
  });
  if (!mapped) return { ok: false, status: 404, error: "Workflow step not found" };

  return {
    ok: true,
    record: record as Record<string, unknown>,
    instance: instance as Record<string, unknown>,
    phase,
    mapped,
    tenantStep: mapped.tenantStepId
      ? tenantSteps.find((step) => step.id === mapped.tenantStepId) ?? null
      : null,
    config,
    applicationId,
  };
}

async function resolveActorName(
  supabase: SupabaseClient,
  actor: { userId: string | null; email: string | null }
): Promise<string | null> {
  if (actor.userId) {
    const { data } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", actor.userId)
      .maybeSingle();
    if (data) {
      return staffDisplayName(
        data.first_name as string | null,
        data.last_name as string | null,
        (data.email as string | null) ?? actor.email
      );
    }
  }
  return actor.email?.trim() || null;
}

export type UnlockedApplicantStep =
  | { step: TenantOnboardingStep; reason: null }
  | { step: null; reason: "WAITING_ON_INTERNAL_STEP" | "NO_NEW_CANDIDATE_STEP" };

/**
 * Candidate-fillable step that completing `completedStepId` newly unlocked, using the same
 * engine-order gate as the applicant portal. Compares the frontier with the staff step
 * pending vs completed, so a candidate who is still working on earlier steps (or is blocked
 * by another internal step) gets no email.
 */
export function resolveUnlockedApplicantStep(params: {
  config: TenantOnboardingConfig;
  progress: WorkerOnboardingProgressPayload;
  completedStepId: string;
}): UnlockedApplicantStep {
  const candidateSteps = getEnabledTenantSteps(params.config);
  const frontierFor = (progress: WorkerOnboardingProgressPayload) =>
    computeCandidateOnboardingFrontier({
      engineOrder: params.config.candidateEngineOrder,
      candidateSteps,
      progress,
    });
  const before = frontierFor({
    ...params.progress,
    steps: params.progress.steps.map((row) =>
      row.onboarding_step_id === params.completedStepId ? { ...row, status: "pending" } : row
    ),
  });
  const after = frontierFor(params.progress);

  const statusById = buildProgressStatusMaps(candidateSteps, params.progress);
  const step = candidateSteps.find((candidate, index) => {
    const position = index + 1;
    if (position <= before.maxAllowedStepIndex || position > after.maxAllowedStepIndex) return false;
    const status = statusById.get(candidate.id) ?? "pending";
    return status !== "completed" && status !== "skipped";
  });
  if (step) return { step, reason: null };
  return {
    step: null,
    reason: after.waitingOnInternal ? "WAITING_ON_INTERNAL_STEP" : "NO_NEW_CANDIDATE_STEP",
  };
}

async function loadProgressPayload(
  supabase: SupabaseClient,
  progressId: string,
  config: TenantOnboardingConfig | null
): Promise<WorkerOnboardingProgressPayload> {
  const [{ data, error }, { data: progressRow, error: progressError }] = await Promise.all([
    supabase
      .from("worker_onboarding_step_progress")
      .select("onboarding_step_id, status, completed_at, data")
      .eq("worker_onboarding_progress_id", progressId),
    supabase
      .from("worker_onboarding_progress")
      .select("status, submitted_at")
      .eq("id", progressId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (progressError) throw progressError;
  const stepKeyById = new Map((config?.steps ?? []).map((step) => [step.id, step.step_key]));
  const steps: StepProgressRow[] = ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const stepId = String(row.onboarding_step_id);
    return {
      onboarding_step_id: stepId,
      step_key: stepKeyById.get(stepId) ?? null,
      status: String(row.status ?? "pending") as OnboardingStepStatus,
      completed_at: asText(row.completed_at),
      data: asObject(row.data),
    };
  });
  return {
    progressId,
    status: asText(progressRow?.status) ?? "in_progress",
    steps,
    submittedAt: asText(progressRow?.submitted_at),
  };
}

async function notifyCandidateNextStep(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    workerId: string;
    applicationId: string | null;
    origin: string | null;
    progressId: string;
    tenantConfig: TenantOnboardingConfig | null;
    completedStepId: string;
    completedStepTitle: string;
  }
): Promise<StaffStepEmailResult> {
  if (!params.origin) return { sent: false, skipped: true, reason: "NO_APP_ORIGIN" };
  try {
    const phaseRecord = params.applicationId
      ? await loadApplicationWorkflowPhase(supabase, {
          tenantId: params.tenantId,
          applicationId: params.applicationId,
        })
      : null;

    let jobToken: string | null = null;
    let jobTitle = "your application";
    if (phaseRecord?.jobRequisitionId) {
      const { data: job } = await supabase
        .from("job_requisitions")
        .select("public_job_token, public_title, source_job_title")
        .eq("id", phaseRecord.jobRequisitionId)
        .eq("tenant_id", params.tenantId)
        .maybeSingle();
      jobToken = asText(job?.public_job_token);
      jobTitle = asText(job?.public_title) ?? asText(job?.source_job_title) ?? jobTitle;
    }

    let config = await loadTenantOnboardingConfig(supabase, params.tenantId, { workerFacing: true });
    if (jobToken) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", params.tenantId)
        .maybeSingle();
      try {
        config = (await loadApplicantConfigForJobToken(supabase, asText(tenant?.slug), jobToken)).config;
      } catch {
        // Stale or unpublished job: fall back to the tenant's published config.
      }
    }
    if (!config) return { sent: false, skipped: true, reason: "NO_APPLICANT_CONFIG" };
    const activePhase = phaseRecord?.phase ?? "pre_hire";
    config = applyApplicantConfigFilters(config, { activePhase });

    const progress = await loadProgressPayload(supabase, params.progressId, params.tenantConfig);
    if (activePhase === "pre_hire" && progress.submittedAt) {
      // Submitted applicants are routed to the status page, so there is nothing to fill in.
      return { sent: false, skipped: true, reason: "APPLICATION_SUBMITTED", nextStepTitle: null };
    }
    const next = resolveUnlockedApplicantStep({
      config,
      progress,
      completedStepId: params.completedStepId,
    });
    if (!next.step) {
      return { sent: false, skipped: true, reason: next.reason, nextStepTitle: null };
    }

    const ctx = await buildApplicantEmailContext(supabase, {
      tenantId: params.tenantId,
      workerId: params.workerId,
      origin: params.origin,
      continuationReason: "step_ready",
      continuationMetadata: {
        purpose: "next_step_ready",
        completedStepTitle: params.completedStepTitle,
        nextStepKey: next.step.step_key,
      },
      applicationId: params.applicationId,
      jobToken,
    });
    if (!ctx) {
      return { sent: false, skipped: true, reason: "NO_APPLICANT_EMAIL", nextStepTitle: next.step.title };
    }

    const result = await sendTemplatedEmail(supabase, {
      to: ctx.applicantEmail,
      tenantId: params.tenantId,
      templateKey: EMAIL_TEMPLATE_TYPE.NEXT_STEP_READY,
      variables: {
        ...contextToTemplateVariables(ctx),
        jobTitle,
        completedStepTitle: params.completedStepTitle,
        nextStepTitle: next.step.title,
        nextStepLink: ctx.applicantContinuationLink,
      },
    });
    return {
      sent: result.sent,
      skipped: result.skipped ?? false,
      reason: result.reason,
      nextStepTitle: next.step.title,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "EMAIL_FAILED";
    console.error("[staff-workflow-step-review] next step email failed", {
      tenantId: params.tenantId,
      workerId: params.workerId,
      reason,
    });
    return { sent: false, skipped: false, reason };
  }
}

export async function applyStaffWorkflowStepAction(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    tenantId: string;
    stepRecordId: string;
    action: StaffStepAction;
    note: string | null;
    actor: { userId: string | null; email: string | null };
    notifyCandidate: boolean;
    origin: string | null;
    request?: Request;
  }
): Promise<StaffStepActionResult> {
  const { workerId, tenantId, action } = params;
  const note = params.note?.trim() || null;
  if (action === "reject" && !note) {
    return { ok: false, status: 400, code: "NOTE_REQUIRED", error: "Add a note explaining why this step is rejected." };
  }

  const ctx = await loadStaffStepContext(supabase, {
    workerId,
    tenantId,
    stepRecordId: params.stepRecordId,
  });
  if (!ctx.ok) return ctx;

  const tenantStepId = ctx.mapped.tenantStepId;
  const initial = resolveStaffStepEligibility(ctx.tenantStep, "pending");
  if (!initial.allowed || !tenantStepId) {
    return {
      ok: false,
      status: 409,
      code: "STEP_NOT_STAFF_OWNED",
      error: initial.reason ?? "This step can't be updated by staff.",
    };
  }

  const progress = await ensureWorkerOnboardingProgress(supabase, workerId, tenantId, ctx.applicationId);
  const progressId = progress.progressId;

  const loadRow = async () => {
    const { data, error } = await supabase
      .from("worker_onboarding_step_progress")
      .select("status, data")
      .eq("worker_onboarding_progress_id", progressId)
      .eq("onboarding_step_id", tenantStepId)
      .maybeSingle();
    if (error) throw error;
    return data as { status?: string | null; data?: unknown } | null;
  };

  let row = await loadRow();
  if (!row) {
    const { error: insertError } = await supabase.from("worker_onboarding_step_progress").insert({
      worker_onboarding_progress_id: progressId,
      worker_id: workerId,
      tenant_id: tenantId,
      onboarding_step_id: tenantStepId,
      status: "pending",
      ...(ctx.applicationId ? { application_id: ctx.applicationId } : {}),
    });
    if (insertError && insertError.code !== "23505") throw insertError;
    row = await loadRow();
  }

  const currentStatus = asText(row?.status) ?? "pending";
  if (!allowedStaffActions(currentStatus).includes(action)) {
    return {
      ok: false,
      status: 409,
      code: "INVALID_TRANSITION",
      error: `This step is already ${currentStatus === "failed" ? "rejected" : currentStatus.replaceAll("_", " ")}. Refresh to see the latest status.`,
    };
  }

  const now = new Date().toISOString();
  const nextStatus = staffActionTargetStatus(action);
  const review: StaffStepReview = {
    decision: action,
    note,
    reviewedByUserId: params.actor.userId,
    reviewedByName: await resolveActorName(supabase, params.actor),
    reviewedAt: now,
  };
  const storedReview = {
    decision: review.decision,
    note: review.note,
    reviewed_by_user_id: review.reviewedByUserId,
    reviewed_by_name: review.reviewedByName,
    reviewed_at: review.reviewedAt,
    previous_status: currentStatus,
    source: "admin_hire_journey",
  };
  const existingData = asObject(row?.data);
  const history = Array.isArray(existingData.staff_review_history)
    ? (existingData.staff_review_history as unknown[])
    : readStaffStepReview(existingData)
      ? [existingData.staff_review]
      : [];

  const { error: updateError } = await supabase
    .from("worker_onboarding_step_progress")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "completed" ? now : null,
      updated_at: now,
      data: {
        ...existingData,
        staff_review: storedReview,
        staff_review_history: [...history, storedReview].slice(-STAFF_REVIEW_HISTORY_LIMIT),
      },
    })
    .eq("worker_onboarding_progress_id", progressId)
    .eq("onboarding_step_id", tenantStepId);
  if (updateError) throw updateError;

  const { error: recordError } = await supabase
    .from("applicant_workflow_step_records")
    .update({
      status: nextStatus,
      completed_at: nextStatus === "completed" ? now : null,
      updated_at: now,
    })
    .eq("id", String(ctx.record.id))
    .eq("tenant_id", tenantId);
  if (recordError) {
    console.error("[staff-workflow-step-review] step record sync failed", recordError.message);
  }

  await writeActivityLog({
    actorUserId: params.actor.userId,
    action: `workflow_step.staff_${action}`,
    entityType: "applicant_workflow_step_record",
    entityId: String(ctx.record.id),
    tenantId,
    metadata: {
      worker_id: workerId,
      application_id: ctx.applicationId,
      onboarding_step_id: tenantStepId,
      step_title: ctx.mapped.title,
      previous_status: currentStatus,
      status: nextStatus,
      note,
    },
    request: params.request,
  });

  const email =
    action === "complete" && params.notifyCandidate
      ? await notifyCandidateNextStep(supabase, {
          tenantId,
          workerId,
          applicationId: ctx.applicationId,
          origin: params.origin,
          progressId,
          tenantConfig: ctx.config,
          completedStepId: tenantStepId,
          completedStepTitle: ctx.mapped.title,
        })
      : null;

  return { ok: true, status: nextStatus, review, email };
}
