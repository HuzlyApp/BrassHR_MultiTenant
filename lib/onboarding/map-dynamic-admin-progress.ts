import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isCompleteDisplayStatus,
  type MappedAssignedStep,
  type WorkflowStepDisplayStatus,
} from "@/lib/onboarding/assigned-workflow-steps";
import { loadCandidateWorkflowPhaseView } from "@/lib/onboarding/candidate-workflow-phase-view";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress";
import { readStepLifecyclePhase } from "@/lib/onboarding/workflow-phase";

type StepState = "complete" | "in_progress" | "pending";

export type DynamicProgressStep = {
  id: string;
  stepKey: string;
  label: string;
  state: StepState;
  detail?: string;
  phase: "pre_hire" | "post_hire";
};

export type DynamicProgressResult = {
  steps: DynamicProgressStep[];
  configVersion: number;
  completedSteps: number;
  totalSteps: number;
  completionPercent: number;
};

function emptyProgress(configVersion = 0): DynamicProgressResult {
  return {
    steps: [],
    configVersion,
    completedSteps: 0,
    totalSteps: 0,
    completionPercent: 0,
  };
}

/**
 * Match hire-stage board counting: complete first, then in-progress, else pending.
 * (submitted / approved / skipped count as complete — same as isCompleteDisplayStatus.)
 */
export function stateFromWorkflowDisplayStatus(
  status: WorkflowStepDisplayStatus | string
): StepState {
  if (isCompleteDisplayStatus(status as WorkflowStepDisplayStatus)) return "complete";
  if (
    status === "in_progress" ||
    status === "under_review" ||
    status === "needs_revision"
  ) {
    return "in_progress";
  }
  return "pending";
}

/** Pure mapper shared by header/profile and aligned with hireStageProgressMeta step rules. */
export function mapAssignedStepsToDynamicProgress(
  steps: Array<
    Pick<MappedAssignedStep, "id" | "stepKey" | "title" | "phase" | "displayStatus" | "detail">
  >,
  configVersion = 0
): DynamicProgressResult {
  const mapped: DynamicProgressStep[] = steps.map((step) => ({
    id: step.id,
    stepKey: step.stepKey,
    label: step.title,
    state: stateFromWorkflowDisplayStatus(step.displayStatus),
    detail: step.detail,
    phase: step.phase === "post_hire" ? "post_hire" : "pre_hire",
  }));

  const totalSteps = mapped.length;
  const completedSteps = mapped.filter((s) => s.state === "complete").length;
  const completionPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return {
    steps: mapped,
    configVersion,
    completedSteps,
    totalSteps,
    completionPercent,
  };
}

export async function mapDynamicAdminOnboardingProgress(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string
): Promise<DynamicProgressResult> {
  // Prefer the candidate's assigned job/workflow steps so header, profile, and
  // hire-journey sidebar share the same completion source of truth.
  try {
    const phaseView = await loadCandidateWorkflowPhaseView(supabase, { workerId, tenantId });
    const hasAssignment =
      phaseView.preHire.assigned || Boolean(phaseView.postHire?.assigned);
    if (hasAssignment) {
      // Include post-hire steps whenever present (even if still locked) so profile
      // can show pre-hire by default and expand post-hire via "View more".
      const assignedSteps = [
        ...phaseView.preHire.steps,
        ...(phaseView.postHire?.steps ?? []),
      ];
      return mapAssignedStepsToDynamicProgress(assignedSteps);
    }
  } catch (error) {
    console.warn(
      "[map-dynamic-admin-progress] assigned workflow unavailable; falling back to tenant config",
      error
    );
  }

  const config = await loadTenantOnboardingConfig(supabase, tenantId, { workerFacing: true });
  if (!config) {
    return emptyProgress();
  }

  const progress = await ensureWorkerOnboardingProgress(supabase, workerId, tenantId);
  const byStep = new Map(progress.steps.map((s) => [s.onboarding_step_id, s]));

  const steps: DynamicProgressStep[] = [];

  for (const step of config.steps.filter((s) => s.is_enabled)) {
    const prog = byStep.get(step.id);
    const status = prog?.status ?? "pending";
    let state: StepState = "pending";
    if (status === "completed" || status === "skipped") state = "complete";
    else if (status === "in_progress" || status === "failed") state = "in_progress";

    let detail: string | undefined;

    if (step.step_type === "resume_upload") {
      const { data: resume } = await supabase
        .from("worker_resumes")
        .select("parsing_status")
        .eq("worker_id", workerId)
        .maybeSingle();
      if (resume) {
        detail = `Parsing: ${resume.parsing_status ?? "pending"}`;
      }
    }

    if (step.step_type === "skill_assessment") {
      const assessments = config.skillAssessments.filter((a) => a.onboarding_step_id === step.id);
      let total = 0;
      let answered = 0;
      for (const a of assessments) {
        total += a.questions.filter((q) => q.is_required).length;
        const { count } = await supabase
          .from("worker_skill_assessment_answers")
          .select("id", { count: "exact", head: true })
          .eq("worker_id", workerId)
          .eq("assessment_id", a.id);
        answered += count ?? 0;
      }
      if (total > 0) detail = `${answered} of ${total} answered`;
    }

    if (step.step_type === "document_upload" || step.step_type === "authorizations") {
      const docs = config.requiredDocuments.filter((d) => d.onboarding_step_id === step.id);
      const required = docs.filter((d) => d.is_required);
      if (required.length) {
        const { data: uploads } = await supabase
          .from("worker_submitted_documents")
          .select("required_document_id, status")
          .eq("worker_id", workerId);
        const uploaded = required.filter((d) =>
          (uploads ?? []).some((u) => String(u.required_document_id) === d.id)
        ).length;
        detail = `${uploaded} of ${required.length} documents`;
      }
    }

    steps.push({
      id: step.id,
      stepKey: step.step_key,
      label: step.title,
      state,
      detail,
      phase: readStepLifecyclePhase(step),
    });
  }

  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.state === "complete").length;
  const completionPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return { steps, configVersion: config.version, completedSteps, totalSteps, completionPercent };
}
