import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { canRevealPostHire } from "@/lib/onboarding/lock-post-hire";
import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";
import {
  ASSIGNED_STEP_RECORD_COLUMNS,
  LEGACY_UNMATCHED_STEP_MESSAGE,
  POST_HIRE_NOT_AVAILABLE_CODE,
  POST_HIRE_NOT_AVAILABLE_MESSAGE,
  STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE,
  displayStatusLabel,
  mapProgressToDisplayStatus,
  parseAssignedStepPhase,
  type MappedAssignedStep,
} from "@/lib/onboarding/assigned-workflow-steps";
import {
  loadScopedStepProgress,
  resolveInstanceApplicationId,
} from "@/lib/onboarding/scoped-step-progress";
import {
  readRecordStaffReview,
  readStaffStepReview,
  type StaffStepActionEligibility,
  type StaffStepReview,
} from "@/lib/onboarding/staff-step-review-shared";
import {
  mapInstanceStepRecord,
  resolveStaffStepEligibility,
} from "@/lib/onboarding/staff-workflow-step-review";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";
import {
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
} from "@/lib/supabase-storage-buckets";
import type { EmploymentLifecyclePhase } from "@/lib/onboarding/workflow-phase-groups";
import {
  buildSkillAssessmentResults,
  type SkillAnswerRowInput,
  type SkillAssessmentResultsSummary,
  type SkillAssessmentRowInput,
  type SkillCategoryResult,
} from "@/lib/skill-assessment/admin-results";
import {
  loadTenantSkillAssessmentSettings,
  publishedCatalogForApplicants,
} from "@/lib/skill-assessment/load-settings";
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults";
import { loadCandidateInterviews } from "@/lib/interviews/candidate-interview-history";
import { loadStepCheckResult, type StepCheckResult } from "@/lib/onboarding/step-check-results";
import { formatInterviewDate, formatInterviewTimeRange } from "@/lib/interviews/format";
import {
  interviewStepStatus,
  isInterviewStep,
  summarizeInterviews,
  type CandidateInterview,
} from "@/lib/onboarding/interview-step";

export type WorkflowStepInspectionKind =
  | "resume"
  | "upload"
  | "form"
  | "assessment"
  | "references"
  | "agreement"
  | "background_check"
  | "final_review"
  | "generic";

export type WorkflowStepInspectionError = {
  ok: false;
  status: number;
  code?: string;
  error: string;
};

export type InspectableDocument = {
  id: string;
  originalFileName: string | null;
  documentType: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
  verificationStatus: string | null;
  previewUrl: string | null;
  downloadUrl: string | null;
  fileUnavailable: boolean;
  approvedOrRejectedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
};

export type WorkflowStepInspection = {
  ok: true;
  kind: WorkflowStepInspectionKind;
  step: MappedAssignedStep;
  workflowName: string | null;
  workflowVersion: string | null;
  phase: EmploymentLifecyclePhase;
  assignedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  approvedOrRejectedAt: string | null;
  completedBy: string | null;
  approvedOrRejectedBy: string | null;
  notes: string | null;
  emptyState: string | null;
  /** Whether staff can complete / reject / reopen this step from the drawer. */
  staffAction: StaffStepActionEligibility;
  staffReview: StaffStepReview | null;
  /** Compliance check / facility approval result for those step types. */
  checkResult: StepCheckResult | null;
  documents: InspectableDocument[];
  form: {
    questions: Array<{
      label: string;
      fieldType: string;
      answer: unknown;
      submittedAt: string | null;
      reviewResult: string | null;
    }>;
  } | null;
  assessment: {
    name: string;
    startedAt: string | null;
    completedAt: string | null;
    summary: SkillAssessmentResultsSummary;
    categories: SkillCategoryResult[];
  } | null;
  references: Array<{
    id: string;
    name: string;
    relationship: string | null;
    email: string | null;
    phone: string | null;
    verificationStatus: string | null;
    submittedAt: string | null;
    recruiterNotes: string | null;
  }>;
  agreement: {
    documentName: string;
    signatureStatus: string;
    sentAt: string | null;
    viewedAt: string | null;
    signedAt: string | null;
    signerIdentity: string | null;
    completedDocumentUrl: string | null;
    auditHistory: Array<{ status: string; at: string | null }>;
  } | null;
  authorization: {
    authorizationStatus: string | null;
    consentTimestamp: string | null;
    providerSafeStatus: string | null;
    reviewStatus: string | null;
  } | null;
  finalReview: {
    submittedAt: string | null;
    confirmation: string | null;
    missingRequirements: string[];
    stepsIncluded: string[];
    reviewer: string | null;
    decision: string | null;
    notes: string | null;
  } | null;
  /** Every interview booked with the candidate, oldest first. Null on non-interview steps. */
  interviews: CandidateInterview[] | null;
};

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function inspectionKindForStep(params: {
  stepType: string;
  onboardingType: string;
}): WorkflowStepInspectionKind {
  const stepType = params.stepType.trim().toLowerCase();
  const onboardingType = params.onboardingType.trim().toLowerCase();
  if (onboardingType === "resume_upload" || stepType === "resume-basic-profile") return "resume";
  if (
    onboardingType === "professional_license" ||
    onboardingType === "document_upload" ||
    stepType === "credential-license-verification" ||
    stepType === "certification-upload" ||
    stepType === "document-upload"
  ) {
    return "upload";
  }
  if (onboardingType === "skill_assessment" || stepType === "skill-qualification-assessment") {
    return "assessment";
  }
  if (onboardingType === "references" || stepType.includes("reference")) return "references";
  if (
    onboardingType === "authorizations" ||
    stepType === "employee-agreement" ||
    stepType === "welcome-packet-esign" ||
    stepType === "policy-acknowledgment"
  ) {
    return "agreement";
  }
  if (stepType === "background-check") return "background_check";
  if (
    onboardingType === "review_submit" ||
    stepType === "completion-milestone" ||
    stepType === "hr-final-approval"
  ) {
    return "final_review";
  }
  if (onboardingType === "custom_question" || onboardingType === "profile_information") return "form";
  return "generic";
}

function signatureStatusLabel(raw: string | null): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "completed" || value === "signed") return "Signed";
  if (value === "viewed") return "Viewed";
  if (value === "sent" || value === "pending") return "Sent";
  if (value === "declined") return "Declined";
  if (value === "expired") return "Expired";
  if (!value) return "Not started";
  return value.replaceAll("_", " ");
}

async function signedOrUnavailable(
  supabase: SupabaseClient,
  stored: string | null | undefined,
  defaultBucket: string
): Promise<{ url: string | null; unavailable: boolean }> {
  const raw = asText(stored);
  if (!raw) return { url: null, unavailable: false };
  const url = await resolveStorageAccessibleUrl(supabase, raw, { defaultBucket });
  return { url, unavailable: !url };
}

export async function loadCandidateWorkflowStepInspection(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    tenantId: string;
    stepId: string;
  }
): Promise<WorkflowStepInspection | WorkflowStepInspectionError> {
  const { workerId, tenantId, stepId } = params;

  const { data: worker, error: workerError } = await supabase
    .from("worker")
    .select("id, status, converted_at, converted_worker_id, conversion_status")
    .eq("id", workerId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (workerError) throw workerError;
  if (!worker) return { ok: false, status: 404, error: "Candidate not found" };

  const postHireVisible = canRevealPostHire({
    workerStatus: asText(worker.status),
    convertedAt: asText(worker.converted_at),
    convertedWorkerId: asText(worker.converted_worker_id),
    conversionStatus: asText(worker.conversion_status),
  });

  const { data: record, error: recordError } = await supabase
    .from("applicant_workflow_step_records")
    .select(ASSIGNED_STEP_RECORD_COLUMNS)
    .eq("id", stepId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (recordError) throw recordError;
  if (!record) {
    return { ok: false, status: 404, error: "Workflow step not found" };
  }

  const { data: instance, error: instanceError } = await supabase
    .from("applicant_workflow_instances")
    .select(
      "id, worker_id, workflow_name, workflow_version, started_at, created_at, tenant_id, application_id"
    )
    .eq("id", record.workflow_instance_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (instanceError) throw instanceError;
  if (!instance || asText(instance.worker_id) !== workerId) {
    return { ok: false, status: 404, error: "Workflow step not found" };
  }

  const phase = parseAssignedStepPhase({
    phase: asText(record.phase),
    settings:
      record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
        ? (record.settings as Record<string, unknown>)
        : {},
  });
  if (phase === "post_hire" && !postHireVisible) {
    return {
      ok: false,
      status: 403,
      code: POST_HIRE_NOT_AVAILABLE_CODE,
      error: POST_HIRE_NOT_AVAILABLE_MESSAGE,
    };
  }

  const applicationId = await resolveInstanceApplicationId(supabase, {
    tenantId,
    instanceId: String(instance.id),
    instanceApplicationId: asText(instance.application_id),
  });
  const [config, progressByStepId] = await Promise.all([
    loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false }),
    loadScopedStepProgress(supabase, { tenantId, workerId, applicationId }),
  ]);
  const tenantSteps = config?.steps ?? [];

  const mapped = await mapInstanceStepRecord(supabase, {
    tenantId,
    instanceId: String(instance.id),
    recordId: String(record.id),
    tenantSteps,
    progressByStepId,
    assignedAt: asText(instance.started_at) ?? asText(instance.created_at),
  });

  if (!mapped) {
    return { ok: false, status: 404, error: "Workflow step not found" };
  }

  const progress = mapped.tenantStepId ? progressByStepId.get(mapped.tenantStepId) : undefined;
  const progressData =
    progress?.data && typeof progress.data === "object" && !Array.isArray(progress.data)
      ? (progress.data as Record<string, unknown>)
      : {};
  const tenantStep = mapped.tenantStepId
    ? tenantSteps.find((step) => step.id === mapped.tenantStepId) ?? null
    : null;
  const recordSettings =
    record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
      ? (record.settings as Record<string, unknown>)
      : {};
  const staffAction = resolveStaffStepEligibility(tenantStep, mapped.status, {
    stepType: asText(record.step_type),
    settings: recordSettings,
  });
  const recordReview = readRecordStaffReview(record);
  const progressReview = readStaffStepReview(progressData);
  const staffReview =
    recordReview && progressReview
      ? Date.parse(progressReview.reviewedAt) > Date.parse(recordReview.reviewedAt)
        ? progressReview
        : recordReview
      : recordReview ?? progressReview;
  const staffDecision =
    staffReview && staffReview.decision !== "reopen" ? staffReview : null;
  const kind = inspectionKindForStep({
    stepType: mapped.stepType,
    onboardingType: mapped.onboardingType || workflowStepIdToOnboardingType(mapped.stepType),
  });

  const requiredDocIds = [
    ...new Set(
      (config?.requiredDocuments ?? [])
        .filter((doc) => doc.onboarding_step_id === mapped.tenantStepId)
        .map((doc) => doc.id)
    ),
  ];

  const submittedRows =
    requiredDocIds.length > 0
      ? (
          await supabase
            .from("worker_submitted_documents")
            .select(
              "id, required_document_id, file_url, original_file_name, file_type, file_size, status, uploaded_at, reviewed_at, reviewed_by, review_notes"
            )
            .eq("tenant_id", tenantId)
            .eq("worker_id", workerId)
            .in("required_document_id", requiredDocIds)
            .order("uploaded_at", { ascending: false })
        ).data ?? []
      : [];

  const documents: InspectableDocument[] = [];
  for (const row of submittedRows as Array<Record<string, unknown>>) {
    const signed = await signedOrUnavailable(
      supabase,
      asText(row.file_url),
      WORKER_REQUIRED_FILES_BUCKET
    );
    documents.push({
      id: String(row.id),
      originalFileName: asText(row.original_file_name),
      documentType: asText(row.file_type),
      fileSize: typeof row.file_size === "number" ? row.file_size : null,
      uploadedAt: asText(row.uploaded_at),
      uploadedBy: "Applicant",
      verificationStatus: asText(row.status),
      previewUrl: signed.url,
      downloadUrl: signed.url,
      fileUnavailable: signed.unavailable,
      approvedOrRejectedAt: asText(row.reviewed_at),
      reviewedBy: asText(row.reviewed_by),
      reviewNotes: asText(row.review_notes),
    });
  }

  if (kind === "resume") {
    const { data: resumes } = await supabase
      .from("worker_resumes")
      .select(
        "id, file_url, storage_path, original_file_name, file_name, file_type, file_size_bytes, uploaded_at, uploaded_by_user_id"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false });
    for (const row of (resumes ?? []) as Array<Record<string, unknown>>) {
      const stored = asText(row.storage_path) ?? asText(row.file_url);
      const signed = await signedOrUnavailable(supabase, stored, WORKER_RESUMES_BUCKET);
      documents.push({
        id: String(row.id),
        originalFileName: asText(row.original_file_name) ?? asText(row.file_name),
        documentType: asText(row.file_type) ?? "resume",
        fileSize: typeof row.file_size_bytes === "number" ? row.file_size_bytes : null,
        uploadedAt: asText(row.uploaded_at),
        uploadedBy: asText(row.uploaded_by_user_id) ? "Staff" : "Applicant",
        verificationStatus: "uploaded",
        previewUrl: signed.url,
        downloadUrl: signed.url,
        fileUnavailable: signed.unavailable,
        approvedOrRejectedAt: null,
        reviewedBy: null,
        reviewNotes: null,
      });
    }
  }

  const latestDoc = documents[0] ?? null;
  mapped.displayStatus = mapProgressToDisplayStatus(mapped.status, latestDoc?.verificationStatus);

  let form: WorkflowStepInspection["form"] = null;
  if (kind === "form" || asText(progressData.response) != null) {
    const prompt = asText(
      (mapped.tenantStepId
        ? config?.steps.find((step) => step.id === mapped.tenantStepId)?.metadata?.prompt
        : null) ?? record.settings?.prompt
    );
    form = {
      questions: [
        {
          label: prompt || mapped.title,
          fieldType: asText(progressData.step_type) || mapped.onboardingType || "text",
          answer: progressData.response ?? null,
          submittedAt: asText(progress?.updated_at) ?? asText(progress?.completed_at),
          reviewResult: asText(progressData.reason),
        },
      ],
    };
  }

  let assessment: WorkflowStepInspection["assessment"] = null;
  if (kind === "assessment") {
    const [{ data: skillRows }, { data: answerRows }, catalog] = await Promise.all([
      supabase
        .from("skill_assessments")
        .select("category, answers, completed, created_at")
        .eq("worker_id", workerId)
        .eq("tenant_id", tenantId),
      supabase
        .from("applicant_skill_assessment_answers")
        .select("category_id, skill_id, answer_value, created_at")
        .eq("tenant_id", tenantId)
        .eq("applicant_id", workerId),
      loadTenantSkillAssessmentSettings(supabase, tenantId)
        .then(publishedCatalogForApplicants)
        .catch(() => createDefaultSkillAssessmentCatalog()),
    ]);
    const assessmentRows = (skillRows ?? []) as SkillAssessmentRowInput[];
    const ratingRows = (answerRows ?? []) as SkillAnswerRowInput[];
    const results = buildSkillAssessmentResults(catalog, assessmentRows, ratingRows);
    const timestamps = [...assessmentRows, ...ratingRows]
      .map((item) => asText(item.created_at))
      .filter((value): value is string => Boolean(value))
      .sort();
    const allCompleted =
      results.summary.totalCategories > 0 &&
      results.summary.completedCategories === results.summary.totalCategories;
    assessment = {
      name: mapped.title,
      startedAt: timestamps[0] ?? null,
      completedAt: allCompleted
        ? asText(progress?.completed_at) ?? timestamps[timestamps.length - 1] ?? null
        : null,
      summary: results.summary,
      categories: results.categories,
    };
  }

  let references: WorkflowStepInspection["references"] = [];
  if (kind === "references") {
    const { data: rows } = await supabase
      .from("worker_references")
      .select(
        "id, reference_first_name, reference_last_name, relationship, reference_email, reference_phone, notes, created_at"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });
    references = ((rows ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      name: `${asText(row.reference_first_name) ?? ""} ${asText(row.reference_last_name) ?? ""}`.trim() || "Reference",
      relationship: asText(row.relationship),
      email: asText(row.reference_email),
      phone: asText(row.reference_phone),
      verificationStatus: null,
      submittedAt: asText(row.created_at),
      recruiterNotes: asText(row.notes),
    }));
  }

  let agreement: WorkflowStepInspection["agreement"] = null;
  if (kind === "agreement") {
    let query = supabase
      .from("worker_firma_signing_sessions")
      .select(
        "id, onboarding_step_id, firma_status, created_at, updated_at, recruiter_template_id"
      )
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false });
    if (mapped.tenantStepId) query = query.eq("onboarding_step_id", mapped.tenantStepId);
    const { data: sessions } = await query;
    const session = ((sessions ?? []) as Array<Record<string, unknown>>)[0] ?? null;
    const completedDoc = documents.find((doc) => doc.verificationStatus === "approved") ?? documents[0] ?? null;
    agreement = session
      ? {
          documentName: mapped.title,
          signatureStatus: signatureStatusLabel(asText(session.firma_status)),
          sentAt: asText(session.created_at),
          viewedAt: null,
          signedAt:
            String(session.firma_status ?? "").toLowerCase() === "completed"
              ? asText(session.updated_at)
              : null,
          signerIdentity: "Applicant",
          completedDocumentUrl: completedDoc?.previewUrl ?? null,
          auditHistory: [
            { status: signatureStatusLabel(asText(session.firma_status)), at: asText(session.updated_at) },
          ],
        }
      : null;
  }

  let authorization: WorkflowStepInspection["authorization"] = null;
  if (kind === "background_check" || kind === "agreement") {
    const partner =
      progressData.partner_dispatch && typeof progressData.partner_dispatch === "object"
        ? (progressData.partner_dispatch as Record<string, unknown>)
        : {};
    authorization = {
      authorizationStatus:
        progressData.authorization_agreed === true
          ? "Authorized"
          : progressData.authorization_agreed === false
            ? "Not authorized"
            : null,
      consentTimestamp: asText(progress?.updated_at) ?? asText(progress?.completed_at),
      providerSafeStatus: asText(partner.status) ?? asText(progressData.firma_status),
      reviewStatus: displayStatusLabel(mapped.displayStatus),
    };
  }

  let finalReview: WorkflowStepInspection["finalReview"] = null;
  if (kind === "final_review") {
    const { data: onboarding } = await supabase
      .from("worker_onboarding_progress")
      .select("submitted_at, submitted_with_incomplete_steps, incomplete_step_keys, status")
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId)
      .maybeSingle();
    const missing = Array.isArray(onboarding?.incomplete_step_keys)
      ? (onboarding?.incomplete_step_keys as unknown[]).map((item) => String(item))
      : [];
    const { data: instanceSteps } = await supabase
      .from("applicant_workflow_step_records")
      .select("title, phase, position")
      .eq("workflow_instance_id", record.workflow_instance_id)
      .eq("tenant_id", tenantId)
      .order("position", { ascending: true });
    finalReview = {
      submittedAt: asText(onboarding?.submitted_at),
      confirmation: onboarding?.submitted_at ? "Candidate submitted this application for review." : null,
      missingRequirements: missing,
      stepsIncluded: ((instanceSteps ?? []) as Array<{ title?: string; phase?: string }>)
        .filter((item) => String(item.phase ?? "") !== "post_hire")
        .map((item) => String(item.title ?? "Step")),
      reviewer: null,
      decision: asText(onboarding?.status),
      notes: asText(progressData.reason),
    };
  }

  const checkResult = await loadStepCheckResult(supabase, {
    tenantId,
    stepRecordId: String(record.id),
    stepType: asText(record.step_type),
  });

  let interviews: CandidateInterview[] | null = null;
  let step = mapped;
  if (isInterviewStep(mapped)) {
    interviews = await loadCandidateInterviews(supabase, { tenantId, workerId });
    step = { ...mapped, interview: summarizeInterviews(interviews) };
  }
  const interviewStatus = interviewStepStatus(step);

  let emptyState: string | null = null;
  if (mapped.unmatched && !staffAction.allowed) emptyState = LEGACY_UNMATCHED_STEP_MESSAGE;
  else if (interviewStatus?.key === "not_scheduled") {
    emptyState = "No interview scheduled yet. Use Schedule Interview to book one with the candidate.";
  } else if (interviewStatus?.key === "scheduled" && step.interview?.latest) {
    const latest = step.interview.latest;
    emptyState = `${latest.title} is scheduled for ${formatInterviewDate(latest.startsAt)}, ${formatInterviewTimeRange(latest.startsAt, latest.endsAt)} ET. After it takes place, add your notes and mark it Completed or Rejected.`;
  } else if (interviewStatus?.key === "awaiting_decision") {
    emptyState = "The interview has taken place. Add your notes and mark it Completed or Rejected.";
  } else if (staffAction.allowed && staffAction.variant === "selection") {
    if (mapped.status === "pending") {
      emptyState = `Waiting for ${staffAction.ownerLabel ?? "the internal team"} to decide whether to move this candidate forward. This step is optional and doesn't block the next stage.`;
    } else if (mapped.status === "in_progress") {
      emptyState = "Candidate is on hold. This doesn't block the next stage.";
    }
  } else if (staffAction.allowed && staffAction.variant === "verification") {
    if (mapped.status === "pending") {
      emptyState = `Waiting for ${staffAction.ownerLabel ?? "the internal team"} to verify the references. This step is optional and doesn't block the candidate's next stage.`;
    } else if (mapped.status === "in_progress") {
      emptyState = "References are marked as needing review. This doesn't block the candidate's next stage.";
    }
  } else if (staffAction.allowed && !mapped.required) {
    if (mapped.status === "pending" || mapped.status === "in_progress") {
      emptyState = `Waiting for ${staffAction.ownerLabel ?? "the internal team"} to complete this step. It's optional, so it doesn't block the candidate's next stage.`;
    }
  } else if (staffAction.allowed) {
    if (mapped.status === "pending" || mapped.status === "in_progress") {
      emptyState = `Waiting for ${staffAction.ownerLabel ?? "the internal team"} to complete this step. The candidate can't continue past it until then.`;
    }
  } else if (
    (kind === "upload" || kind === "resume") &&
    documents.length === 0 &&
    (mapped.status === "completed" || mapped.displayStatus === "completed")
  ) {
    emptyState = STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE;
  } else if (
    kind === "form" &&
    !asText(progressData.response) &&
    mapped.status === "completed"
  ) {
    emptyState = STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE;
  } else if (!progress && documents.length === 0 && mapped.status === "pending") {
    emptyState = "No submission received for this step.";
  } else if (mapped.status === "completed" && documents.length === 0 && !form && !assessment && !agreement) {
    emptyState = STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE;
  }

  return {
    ok: true,
    kind,
    step,
    workflowName: asText(instance.workflow_name),
    workflowVersion: asText(instance.workflow_version),
    phase,
    assignedAt: asText(instance.started_at) ?? asText(instance.created_at),
    startedAt: asText(progress?.created_at),
    submittedAt: asText(progress?.updated_at),
    completedAt: mapped.completedAt,
    approvedOrRejectedAt: latestDoc?.approvedOrRejectedAt ?? staffDecision?.reviewedAt ?? null,
    completedBy:
      staffDecision?.decision === "complete"
        ? staffDecision.reviewedByName ?? staffAction.ownerLabel
        : staffAction.allowed
          ? null
          : progress
            ? "Applicant"
            : null,
    approvedOrRejectedBy: latestDoc?.reviewedBy ?? staffDecision?.reviewedByName ?? null,
    notes: latestDoc?.reviewNotes ?? staffReview?.note ?? asText(progressData.reason),
    emptyState,
    staffAction,
    staffReview,
    checkResult,
    documents,
    form,
    assessment,
    references,
    agreement,
    authorization: kind === "background_check" ? authorization : kind === "agreement" ? authorization : authorization,
    finalReview,
    interviews,
  };
}
