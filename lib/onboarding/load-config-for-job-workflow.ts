import type { OnboardingDbClient } from "@/lib/onboarding/load-tenant-config";
import { loadTenantOnboardingConfig } from "@/lib/onboarding/load-tenant-config";
import { getOnboardingFlowById } from "@/lib/onboarding/onboarding-flows";
import { applyApplicantConfigFilters } from "@/lib/onboarding/filter-applicant-steps";
import { workflowStateToStepDrafts } from "@/lib/onboarding/workflow-to-drafts";
import { enforceUploadResumeFirstInWorkflowState } from "@/lib/onboarding/normalize-builder-workflow";
import {
  isSerializableWorkflowState,
  type SerializableWorkflowState,
} from "@/lib/onboarding/workflow-builder-serialization";
import { normalizeJobToken } from "@/lib/jobs/public-application-routing";
import {
  JobApplicationGateError,
  validatePublishedJobForApplication,
} from "@/lib/jobs/validate-job-application";
import type { OnboardingStepDraft } from "@/lib/onboarding/default-onboarding-steps";
import type { TenantOnboardingConfig, TenantOnboardingStep } from "@/lib/onboarding/types";

function workflowNodeId(meta: Record<string, unknown> | undefined): string | null {
  const value = meta?.workflow_node_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function workflowStepId(meta: Record<string, unknown> | undefined): string | null {
  const value = meta?.workflow_step_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Prefer real published step UUIDs so progress FK writes keep working. */
export function matchPublishedStepForJobDraft(
  publishedSteps: TenantOnboardingStep[],
  draft: OnboardingStepDraft,
  usedIds: Set<string>
): TenantOnboardingStep | null {
  const available = publishedSteps.filter((step) => !usedIds.has(step.id));

  const draftNodeId = workflowNodeId(draft.metadata);
  if (draftNodeId) {
    const byNode = available.find((step) => workflowNodeId(step.metadata) === draftNodeId);
    if (byNode) return byNode;
  }

  const draftWorkflowStepId = workflowStepId(draft.metadata);
  if (draftWorkflowStepId) {
    const byWorkflowStep = available.find(
      (step) => workflowStepId(step.metadata) === draftWorkflowStepId
    );
    if (byWorkflowStep) return byWorkflowStep;
  }

  const byKey = available.find((step) => step.step_key === draft.step_key);
  if (byKey) return byKey;

  const draftBase = draft.step_key.replace(/_\d+$/, "");
  const byBaseKey = available.find((step) => step.step_key.replace(/_\d+$/, "") === draftBase);
  if (byBaseKey) return byBaseKey;

  return available.find((step) => step.step_type === draft.step_type) ?? null;
}

/**
 * Builds applicant-facing config from a job's published onboarding flow canvas.
 * Step order/titles/settings come from the flow; IDs reuse published tenant steps when possible.
 */
export function configFromJobWorkflowDraft(
  published: TenantOnboardingConfig,
  builderDraft: SerializableWorkflowState
): TenantOnboardingConfig {
  const normalizedDraft = enforceUploadResumeFirstInWorkflowState(builderDraft, []);
  const stepDrafts = workflowStateToStepDrafts(normalizedDraft, []).filter(
    (step) => step.is_enabled !== false
  );

  const usedIds = new Set<string>();
  const steps: TenantOnboardingStep[] = stepDrafts.map((draft, index) => {
    const matched = matchPublishedStepForJobDraft(published.steps, draft, usedIds);
    if (matched) usedIds.add(matched.id);

    return {
      id: matched?.id ?? `preview-${draft.step_key}`,
      step_key: draft.step_key,
      title: draft.title,
      description: draft.description?.trim() || null,
      step_type: draft.step_type,
      sort_order: draft.sort_order ?? (index + 1) * 10,
      is_required: draft.is_required,
      is_enabled: true,
      metadata: draft.metadata ?? {},
    };
  });

  const publishedIdToJobId = new Map<string, string>();
  for (const step of steps) {
    if (!step.id.startsWith("preview-")) {
      publishedIdToJobId.set(step.id, step.id);
    }
  }

  return {
    ...published,
    steps,
    requiredDocuments: published.requiredDocuments
      .filter((doc) => publishedIdToJobId.has(doc.onboarding_step_id))
      .map((doc) => ({
        ...doc,
        onboarding_step_id: publishedIdToJobId.get(doc.onboarding_step_id)!,
      })),
    skillAssessments: published.skillAssessments
      .filter((assessment) => publishedIdToJobId.has(assessment.onboarding_step_id))
      .map((assessment) => ({
        ...assessment,
        onboarding_step_id: publishedIdToJobId.get(assessment.onboarding_step_id)!,
      })),
  };
}

export type JobWorkflowConfigResult = {
  config: TenantOnboardingConfig;
  tenantId: string;
  tenantSlug: string;
  workflowId: string;
  workflowName: string;
  jobToken: string;
};

/**
 * Resolve applicant onboarding steps for a published job's assigned workflow.
 */
export async function loadApplicantConfigForJobToken(
  supabase: OnboardingDbClient,
  tenantSlug: string | null | undefined,
  jobTokenInput: string | null | undefined
): Promise<JobWorkflowConfigResult> {
  const jobToken = normalizeJobToken(jobTokenInput);
  if (!jobToken) {
    throw new JobApplicationGateError(
      "A job must be selected before starting an application.",
      "JOB_TOKEN_REQUIRED"
    );
  }

  const validated = await validatePublishedJobForApplication(supabase, tenantSlug, jobToken);
  const flow = await getOnboardingFlowById(supabase, validated.tenantId, validated.workflowId);
  if (!flow || flow.status !== "published") {
    throw new JobApplicationGateError(
      "This job's onboarding workflow is unavailable.",
      "WORKFLOW_UNAVAILABLE"
    );
  }

  if (!isSerializableWorkflowState(flow.builderDraft) || !flow.builderDraft.nodes.length) {
    throw new JobApplicationGateError(
      "This job's onboarding workflow is unavailable.",
      "WORKFLOW_DRAFT_MISSING"
    );
  }

  const published = await loadTenantOnboardingConfig(supabase, validated.tenantId, {
    workerFacing: false,
  });
  if (!published) {
    throw new JobApplicationGateError(
      "Onboarding configuration is missing for this organization.",
      "TENANT_CONFIG_MISSING"
    );
  }

  const fromFlow = configFromJobWorkflowDraft(published, flow.builderDraft);
  const config = applyApplicantConfigFilters(fromFlow);
  if (!config.steps.length) {
    throw new JobApplicationGateError(
      "This job's onboarding workflow has no applicant steps.",
      "WORKFLOW_EMPTY"
    );
  }

  return {
    config,
    tenantId: validated.tenantId,
    tenantSlug: validated.tenantSlug,
    workflowId: validated.workflowId,
    workflowName: validated.workflowName || flow.name,
    jobToken: validated.jobToken,
  };
}
