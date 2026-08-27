import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { canRevealPostHire } from "@/lib/onboarding/lock-post-hire";
import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";
import {
  LEGACY_UNMATCHED_STEP_MESSAGE,
  POST_HIRE_NOT_AVAILABLE_CODE,
  POST_HIRE_NOT_AVAILABLE_MESSAGE,
  STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE,
  displayStatusLabel,
  mapAssignedStepRecords,
  mapProgressToDisplayStatus,
  parseAssignedStepPhase,
  type MappedAssignedStep,
} from "@/lib/onboarding/assigned-workflow-steps";
import { resolveStorageAccessibleUrl } from "@/lib/supabase/resolve-storage-accessible-url";
import {
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
} from "@/lib/supabase-storage-buckets";
import type { EmploymentLifecyclePhase } from "@/lib/onboarding/workflow-phase-groups";

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
    score: number | null;
    passingRequirement: string | null;
    attemptNumber: number | null;
    startedAt: string | null;
    completedAt: string | null;
    reviewStatus: string | null;
    responses: Array<{ question: string; answer: unknown }>;
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
    .select(
      "id, tenant_id, workflow_instance_id, snapshot_step_id, title, step_type, is_required, status, position, phase, settings, completed_at, created_at"
    )
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
      "id, worker_id, workflow_name, workflow_version, started_at, created_at, tenant_id"
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

  const [config, progressRes] = await Promise.all([
    loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: false }),
    supabase
      .from("worker_onboarding_step_progress")
      .select("onboarding_step_id, status, completed_at, created_at, updated_at, data")
      .eq("tenant_id", tenantId)
      .eq("worker_id", workerId),
  ]);

  const progressByStepId = new Map(
    ((progressRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.onboarding_step_id ?? ""),
      row,
    ])
  );
  const mapped = mapAssignedStepRecords({
    records: [
      {
        id: String(record.id),
        snapshot_step_id: String(record.snapshot_step_id ?? ""),
        title: String(record.title ?? "Step"),
        step_type: String(record.step_type ?? "custom-step"),
        is_required: record.is_required !== false,
        status: asText(record.status),
        position: typeof record.position === "number" ? record.position : 0,
        phase: asText(record.phase),
        settings:
          record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
            ? (record.settings as Record<string, unknown>)
            : {},
        completed_at: asText(record.completed_at),
        created_at: asText(record.created_at),
      },
    ],
    tenantSteps: (config?.steps ?? []).filter((step) => step.is_enabled),
    progressByStepId,
    assignedAt: asText(instance.started_at) ?? asText(instance.created_at),
  })[0];

  if (!mapped) {
    return { ok: false, status: 404, error: "Workflow step not found" };
  }

  const progress = mapped.tenantStepId ? progressByStepId.get(mapped.tenantStepId) : undefined;
  const progressData =
    progress?.data && typeof progress.data === "object" && !Array.isArray(progress.data)
      ? (progress.data as Record<string, unknown>)
      : {};
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
    const tenantAssessment = (config?.skillAssessments ?? []).find(
      (item) => item.onboarding_step_id === mapped.tenantStepId
    );
    const { data: skillRows } = await supabase
      .from("skill_assessments")
      .select("id, category, answers, completed, created_at")
      .eq("worker_id", workerId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    const row = ((skillRows ?? []) as Array<Record<string, unknown>>)[0] ?? null;
    const answers =
      row?.answers && typeof row.answers === "object" && !Array.isArray(row.answers)
        ? (row.answers as Record<string, unknown>)
        : {};
    const { data: answerRows } = await supabase
      .from("applicant_skill_assessment_answers")
      .select("skill_id, answer_value, created_at")
      .eq("tenant_id", tenantId)
      .eq("applicant_id", workerId);
    const questionIds = [...new Set((answerRows ?? []).map((item) => String(item.skill_id ?? "")).filter(Boolean))];
    const { data: questions } =
      questionIds.length > 0
        ? await supabase.from("skill_questions").select("id, question").in("id", questionIds)
        : { data: [] };
    const questionById = new Map(
      ((questions ?? []) as Array<Record<string, unknown>>).map((item) => [
        String(item.id),
        asText(item.question) ?? "Question",
      ])
    );
    const responses =
      (answerRows ?? []).length > 0
        ? (answerRows ?? []).map((item) => ({
            question: questionById.get(String(item.skill_id)) ?? "Question",
            answer: item.answer_value,
          }))
        : Object.entries(answers).map(([question, answer]) => ({ question, answer }));
    assessment = {
      name: tenantAssessment?.title || mapped.title,
      score: null,
      passingRequirement: null,
      attemptNumber: skillRows?.length ?? (responses.length ? 1 : null),
      startedAt: asText(row?.created_at),
      completedAt: row?.completed === true ? asText(progress?.completed_at) : null,
      reviewStatus: row?.completed === true ? "Completed" : mapped.status,
      responses,
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

  let emptyState: string | null = null;
  if (mapped.unmatched) emptyState = LEGACY_UNMATCHED_STEP_MESSAGE;
  else if (
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
    step: mapped,
    workflowName: asText(instance.workflow_name),
    workflowVersion: asText(instance.workflow_version),
    phase,
    assignedAt: asText(instance.started_at) ?? asText(instance.created_at),
    startedAt: asText(progress?.created_at),
    submittedAt: asText(progress?.updated_at),
    completedAt: asText(progress?.completed_at) ?? mapped.completedAt,
    approvedOrRejectedAt: latestDoc?.approvedOrRejectedAt ?? null,
    completedBy: progress ? "Applicant" : null,
    approvedOrRejectedBy: latestDoc?.reviewedBy ?? null,
    notes: latestDoc?.reviewNotes ?? asText(progressData.reason),
    emptyState,
    documents,
    form,
    assessment,
    references,
    agreement,
    authorization: kind === "background_check" ? authorization : kind === "agreement" ? authorization : authorization,
    finalReview,
  };
}
