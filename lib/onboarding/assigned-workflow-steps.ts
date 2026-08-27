import { workflowStepIdToOnboardingType } from "@/lib/onboarding/workflow-step-mapping";
import type { OnboardingStepStatus, TenantOnboardingStep } from "@/lib/onboarding/types";
import { readStepLifecyclePhase } from "@/lib/onboarding/workflow-phase";
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

export function isCompleteDisplayStatus(status: WorkflowStepDisplayStatus | OnboardingStepStatus): boolean {
  return (
    status === "completed" ||
    status === "approved" ||
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
 */
export function matchTenantStepForAssignedRecord(
  record: AssignedStepRecordInput,
  tenantSteps: TenantOnboardingStep[],
  usedIds: Set<string>
): TenantOnboardingStep | null {
  const available = tenantSteps.filter((step) => !usedIds.has(step.id));
  const settings = record.settings && typeof record.settings === "object" ? record.settings : {};
  const explicitId = asText(settings.onboarding_step_id);
  if (explicitId) {
    const found = available.find((step) => step.id === explicitId);
    if (found) return found;
  }

  const snapshotId = asText(record.snapshot_step_id);
  if (snapshotId) {
    const byNode = available.find((step) => tenantWorkflowNodeId(step) === snapshotId);
    if (byNode) return byNode;

    const key = snapshotStepKey(snapshotId);
    const byKey = available.find((step) => step.step_key === key);
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
    return {
      id: record.id,
      snapshotStepId: record.snapshot_step_id,
      tenantStepId: matched?.id ?? null,
      title: record.title,
      stepKey: matched?.step_key ?? snapshotStepKey(record.snapshot_step_id),
      stepType: record.step_type,
      onboardingType: matched?.step_type ?? workflowStepIdToOnboardingType(record.step_type),
      phase: parseAssignedStepPhase(record),
      required: record.is_required !== false,
      status: normalizedStatus,
      displayStatus: mapProgressToDisplayStatus(normalizedStatus),
      inspectable: true,
      unmatched,
      detail: unmatched
        ? "This step could not be linked to a stored submission record."
        : undefined,
      assignedAt: params.assignedAt ?? record.created_at ?? null,
      completedAt: progress?.completed_at ?? record.completed_at ?? null,
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
