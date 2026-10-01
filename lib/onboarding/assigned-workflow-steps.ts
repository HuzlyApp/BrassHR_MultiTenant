import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";
import { readStepLifecyclePhase } from "@/lib/onboarding/workflow-phase";
import {
  isAlwaysOptionalStep,
  isReferenceVerificationStep,
} from "@/lib/onboarding/reference-verification";
import { isApplicantCompletionOwner } from "@/lib/onboarding/workflow-settings";
import {
  decisionLabel,
  isDecisionVariant,
  staffStepVariantForLibraryId,
  type StaffDecisionAction,
} from "@/lib/onboarding/staff-step-review-shared";
import {
  interviewStepStatus,
  type InterviewStepSummary,
  type StepPillTone,
} from "@/lib/onboarding/interview-step";
import {
  countsForPhase,
  readNodeLifecyclePhase,
  type EmploymentLifecyclePhase,
  type PhaseProgressCounts,
} from "@/lib/onboarding/workflow-phase-groups";

export type WorkflowStepDisplayStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "completed"
  | "approved"
  | "rejected"
  | "needs_revision"
  | "skipped"
  | "not_applicable"
  | "blocked";

export type WorkflowAssignmentSource = "job_mapping" | "manual" | "unknown";

export type AssignedStepRecordInput = {
  id: string;
  snapshot_step_id: string;
  title: string;
  step_type: string;
  is_required: boolean;
  status?: string | null;
  position: number;
  phase?: string | null;
  settings?: Record<string, unknown> | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type ProgressRowInput = {
  onboarding_step_id?: string | null;
  status?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  data?: Record<string, unknown> | null;
};

export type CandidateWorkflowAssignmentView = {
  workflowName: string;
  phase: EmploymentLifecyclePhase;
  version: string | null;
  assignedAt: string | null;
  assignmentSource: WorkflowAssignmentSource;
  currentStepTitle: string | null;
  completedCount: number;
  totalCount: number;
};

export type MappedAssignedStep = {
  id: string;
  snapshotStepId: string;
  tenantStepId: string | null;
  title: string;
  stepKey: string;
  stepType: string;
  onboardingType: string;
  phase: EmploymentLifecyclePhase;
  required: boolean;
  status: OnboardingStepStatus;
  displayStatus: WorkflowStepDisplayStatus;
  inspectable: boolean;
  unmatched: boolean;
  detail?: string;
  assignedAt: string | null;
  completedAt: string | null;
  /** Workflow builder settings (includes Figma stageName when present). */
  settings?: Record<string, unknown> | null;
  /** Booked interviews, set on interview steps by admin views. */
  interview?: InterviewStepSummary | null;
};

function asText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function snapshotStepKey(snapshotStepId: string): string {
  return snapshotStepId.replace(/^step-/, "").trim();
}

export function parseAssignedStepPhase(
  record: Pick<AssignedStepRecordInput, "phase" | "settings">
): EmploymentLifecyclePhase {
  const fromColumn = asText(record.phase);
  if (fromColumn === "post_hire") return "post_hire";
  if (fromColumn === "pre_hire" || fromColumn === "transition") return "pre_hire";
  return readNodeLifecyclePhase(record.settings?.phase);
}

export function mapProgressToDisplayStatus(
  progressStatus: string | null | undefined,
  documentStatus?: string | null
): WorkflowStepDisplayStatus {
  const doc = String(documentStatus ?? "").trim().toLowerCase();
  if (doc === "rejected") return "rejected";
  if (doc === "needs_revision" || doc === "revision_requested") return "needs_revision";
  if (doc === "approved") return "approved";
  if (doc === "uploaded" || doc === "submitted") return "submitted";
  if (doc === "under_review" || doc === "review") return "under_review";

  const status = String(progressStatus ?? "").trim().toLowerCase();
  if (status === "completed") return "completed";
  if (status === "in_progress") return "in_progress";
  if (status === "skipped") return "skipped";
  if (status === "failed") return "blocked";
  if (status === "not_applicable" || status === "n/a") return "not_applicable";
  if (status === "submitted") return "submitted";
  if (status === "under_review") return "under_review";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "blocked") return "blocked";
  return "not_started";
}

/** Resume / profile collection steps often have evidence in worker_resumes, not step_progress. */
export function isResumeLikeAssignedStep(step: {
  stepKey?: string | null;
  stepType?: string | null;
  onboardingType?: string | null;
  title?: string | null;
}): boolean {
  const hay = `${step.stepKey ?? ""} ${step.stepType ?? ""} ${step.onboardingType ?? ""} ${step.title ?? ""}`
    .trim()
    .toLowerCase();
  return /resume/.test(hay) || hay.includes("basic profile");
}

/**
 * Align list-card displayStatus with the step drawer: uploaded docs / resumes
 * should show Submitted (etc.) even when worker_onboarding_step_progress is still pending.
 */
export function enrichAssignedStepsDisplayFromEvidence(params: {
  steps: MappedAssignedStep[];
  documentStatusByStepKey?: Map<string, string | null | undefined>;
  hasResumeUpload?: boolean;
}): MappedAssignedStep[] {
  const byKey = params.documentStatusByStepKey ?? new Map();
  return params.steps.map((step) => {
    let docStatus =
      byKey.get(step.stepKey) ??
      byKey.get(step.stepType) ??
      byKey.get(step.onboardingType) ??
      null;

    if (!docStatus && params.hasResumeUpload && isResumeLikeAssignedStep(step)) {
      docStatus = "uploaded";
    }

    if (!docStatus) return step;

    const displayStatus = mapProgressToDisplayStatus(step.status, docStatus);
    if (displayStatus === step.displayStatus) return step;
    return { ...step, displayStatus };
  });
}

export function displayStatusLabel(status: WorkflowStepDisplayStatus): string {
  const labels: Record<WorkflowStepDisplayStatus, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    submitted: "Submitted",
    under_review: "Under Review",
    completed: "Completed",
    approved: "Approved",
    rejected: "Rejected",
    needs_revision: "Needs Revision",
    skipped: "Skipped",
    not_applicable: "Not Applicable",
    blocked: "Blocked",
  };
  return labels[status];
}

export { isReferenceVerificationStep };

/**
 * Decision steps are only touched by staff, so each status maps to the button that produced it
 * (e.g. Selected / On Hold / Not Selected); undecided reads as "Pending Decision", never "Not Started".
 */
function decisionForDisplayStatus(status: WorkflowStepDisplayStatus): StaffDecisionAction | null {
  switch (status) {
    case "completed":
    case "approved":
      return "complete";
    case "in_progress":
    case "under_review":
    case "needs_revision":
      return "needs_review";
    case "rejected":
    case "blocked":
      return "reject";
    default:
      return null;
  }
}

/** Staff decision on a decision step (reference verification, internal select), or null while undecided. */
export function stepDecision(step: {
  displayStatus: WorkflowStepDisplayStatus;
  stepType?: string | null;
}): { action: StaffDecisionAction; label: string } | null {
  const variant = staffStepVariantForLibraryId(step.stepType);
  if (!isDecisionVariant(variant)) return null;
  const action = decisionForDisplayStatus(step.displayStatus);
  return action ? { action, label: decisionLabel(variant, action) } : null;
}

type StepStatusInput = {
  displayStatus: WorkflowStepDisplayStatus;
  stepType?: string | null;
  interview?: InterviewStepSummary | null;
};

const DECISION_PILL_TONE: Record<StaffDecisionAction, StepPillTone> = {
  complete: "success",
  needs_review: "warning",
  reject: "danger",
};

/** Status pill for the right end of a step row; null when the row shows an icon instead. */
export function stepStatusPill(step: StepStatusInput): { label: string; tone: StepPillTone } | null {
  const interview = interviewStepStatus(step);
  if (interview) return interview.key === "not_scheduled" ? null : { label: interview.label, tone: interview.tone };
  const decision = stepDecision(step);
  if (decision) return { label: decision.label, tone: DECISION_PILL_TONE[decision.action] };
  if (step.displayStatus === "rejected" || step.displayStatus === "blocked") {
    return { label: "Rejected", tone: "danger" };
  }
  return null;
}

/** Step-aware wording for admin views. */
export function stepDisplayStatusLabel(step: StepStatusInput): string {
  const interview = interviewStepStatus(step);
  if (interview) return interview.label;
  const variant = staffStepVariantForLibraryId(step.stepType);
  if (!isDecisionVariant(variant)) {
    // Staff reject stores `failed`, which maps to `blocked`.
    return step.displayStatus === "blocked" ? "Rejected" : displayStatusLabel(step.displayStatus);
  }
  if (step.displayStatus === "skipped" || step.displayStatus === "not_applicable") {
    return displayStatusLabel(step.displayStatus);
  }
  return decisionLabel(variant, decisionForDisplayStatus(step.displayStatus));
}

export function isCompleteDisplayStatus(status: WorkflowStepDisplayStatus | OnboardingStepStatus): boolean {
  return (
    status === "completed" ||
    status === "approved" ||
    status === "submitted" ||
    status === "skipped" ||
    status === "not_applicable"
  );
}

export function resolveAssignmentSource(params: {
  workflowId?: string | null;
  mappedWorkflowIds?: Iterable<string>;
}): WorkflowAssignmentSource {
  const workflowId = asText(params.workflowId);
  if (!workflowId) return "unknown";
  const mapped = new Set(
    Array.from(params.mappedWorkflowIds ?? [])
      .map((id) => asText(id))
      .filter((id): id is string => Boolean(id))
  );
  if (mapped.has(workflowId)) return "job_mapping";
  return "manual";
}

export function assignmentSourceLabel(source: WorkflowAssignmentSource): string {
  if (source === "job_mapping") return "Job mapping";
  if (source === "manual") return "Manual assignment";
  return "Unknown";
}

function tenantWorkflowNodeId(step: TenantOnboardingStep): string | null {
  return asText(step.metadata?.workflow_node_id);
}

function tenantWorkflowStepId(step: TenantOnboardingStep): string | null {
  return asText(step.metadata?.workflow_step_id);
}

/**
 * Link a snapshot step to a published tenant step without guessing by title.
 * Order: explicit settings id → workflow_node_id → step-{key} → unique library id + phase → unique type + phase.
 *
 * Exact links also consider disabled tenant steps: job workflows keep writing progress to steps
 * that a later publish of a different flow disabled. Heuristic fallbacks stay on enabled steps.
 */
export function matchTenantStepForAssignedRecord(
  record: AssignedStepRecordInput,
  tenantSteps: TenantOnboardingStep[],
  usedIds: Set<string>
): TenantOnboardingStep | null {
  const unused = tenantSteps.filter((step) => !usedIds.has(step.id));
  const available = unused.filter((step) => step.is_enabled !== false);
  const exactCandidates = [...available, ...unused.filter((step) => step.is_enabled === false)];
  const settings = record.settings && typeof record.settings === "object" ? record.settings : {};
  const explicitId = asText(settings.onboarding_step_id);
  if (explicitId) {
    const found = exactCandidates.find((step) => step.id === explicitId);
    if (found) return found;
  }

  const snapshotId = asText(record.snapshot_step_id);
  if (snapshotId) {
    const byNode = exactCandidates.find((step) => tenantWorkflowNodeId(step) === snapshotId);
    if (byNode) return byNode;

    const key = snapshotStepKey(snapshotId);
    const byKey = exactCandidates.find((step) => step.step_key === key);
    if (byKey) return byKey;
  }

  const libraryId = asText(record.step_type);
  const phase = parseAssignedStepPhase(record);
  if (libraryId) {
    const byLibrary = available.filter((step) => tenantWorkflowStepId(step) === libraryId);
    if (byLibrary.length === 1) return byLibrary[0];
    const byLibraryPhase = byLibrary.filter((step) => readStepLifecyclePhase(step) === phase);
    if (byLibraryPhase.length === 1) return byLibraryPhase[0];
  }

  const onboardingType = workflowStepIdToOnboardingType(libraryId ?? "");
  const byTypePhase = available.filter(
    (step) => step.step_type === onboardingType && readStepLifecyclePhase(step) === phase
  );
  if (byTypePhase.length === 1) return byTypePhase[0];
  return null;
}

export function mapAssignedStepRecords(params: {
  records: AssignedStepRecordInput[];
  tenantSteps: TenantOnboardingStep[];
  progressByStepId: Map<string, ProgressRowInput>;
  assignedAt?: string | null;
}): MappedAssignedStep[] {
  const usedIds = new Set<string>();
  return params.records.map((record) => {
    const matched = matchTenantStepForAssignedRecord(record, params.tenantSteps, usedIds);
    if (matched) usedIds.add(matched.id);
    const progress = matched ? params.progressByStepId.get(matched.id) : undefined;
    const progressStatus = (asText(progress?.status) ?? asText(record.status) ?? "pending") as OnboardingStepStatus;
    const normalizedStatus: OnboardingStepStatus = [
      "pending",
      "in_progress",
      "completed",
      "skipped",
      "failed",
    ].includes(progressStatus)
      ? progressStatus
      : "pending";
    const unmatched = !matched;
    const settings =
      record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
        ? record.settings
        : null;
    return {
      id: record.id,
      snapshotStepId: record.snapshot_step_id,
      tenantStepId: matched?.id ?? null,
      title: record.title,
      stepKey: matched?.step_key ?? snapshotStepKey(record.snapshot_step_id),
      stepType: record.step_type,
      onboardingType: matched?.step_type ?? workflowStepIdToOnboardingType(record.step_type),
      phase: parseAssignedStepPhase(record),
      required: record.is_required !== false && !isAlwaysOptionalStep({ stepType: record.step_type }),
      status: normalizedStatus,
      displayStatus: mapProgressToDisplayStatus(normalizedStatus),
      inspectable: true,
      unmatched,
      // Staff-owned unmatched steps are reviewed on the record itself, so only candidate steps lose data.
      detail:
        unmatched && isApplicantCompletionOwner(asText(settings?.completionOwner))
          ? "This step could not be linked to a stored submission record."
          : undefined,
      assignedAt: params.assignedAt ?? record.created_at ?? null,
      completedAt: progress?.completed_at ?? record.completed_at ?? null,
      settings,
    };
  });
}

export function buildPhaseAssignment(params: {
  workflowName: string | null;
  version: string | null;
  assignedAt: string | null;
  assignmentSource: WorkflowAssignmentSource;
  phase: EmploymentLifecyclePhase;
  steps: Array<{ title: string; status: OnboardingStepStatus; displayStatus?: WorkflowStepDisplayStatus }>;
}): CandidateWorkflowAssignmentView {
  const current =
    params.steps.find((step) => step.status === "in_progress") ??
    params.steps.find((step) => step.status === "pending" || step.status === "failed") ??
    null;
  const complete = params.steps.filter((step) =>
    isCompleteDisplayStatus(step.displayStatus ?? step.status)
  ).length;
  return {
    workflowName: params.workflowName?.trim() || "Workflow",
    phase: params.phase,
    version: params.version,
    assignedAt: params.assignedAt,
    assignmentSource: params.assignmentSource,
    currentStepTitle: current?.title ?? null,
    completedCount: complete,
    totalCount: params.steps.length,
  };
}

export function countsFromAssignedSteps(
  steps: Array<{ status: OnboardingStepStatus; displayStatus?: WorkflowStepDisplayStatus }>,
  phase: EmploymentLifecyclePhase
): PhaseProgressCounts {
  return countsForPhase(
    steps.length,
    steps.filter((step) => isCompleteDisplayStatus(step.displayStatus ?? step.status)).length,
    phase
  );
}

export function sanitizeTagsForClient<T extends { phase: EmploymentLifecyclePhase | "both" }>(
  tags: T[],
  postHireVisible: boolean
): T[] {
  if (postHireVisible) return tags;
  return tags
    .filter((tag) => tag.phase !== "post_hire")
    .map((tag) => (tag.phase === "both" ? { ...tag, phase: "pre_hire" as const } : tag));
}

export const POST_HIRE_NOT_AVAILABLE_CODE = "POST_HIRE_NOT_AVAILABLE";
export const POST_HIRE_NOT_AVAILABLE_MESSAGE =
  "Post-Hire is not available until this candidate is converted to a worker.";
export const POST_HIRE_UNASSIGNED_MESSAGE =
  "No Post-Hire workflow has been assigned to this worker.";
export const PRE_HIRE_UNASSIGNED_MESSAGE = "No Pre-Hire workflow is assigned to this applicant.";
export const STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE =
  "Completed through candidate confirmation. No document was required.";
export const LEGACY_UNMATCHED_STEP_MESSAGE =
  "This step could not be linked to a stored submission record.";
