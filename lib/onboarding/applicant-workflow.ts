import type { OnboardingStepType, TenantOnboardingStep } from "@/lib/onboarding/types";
import type {
  PublishedWorkflow,
  PublishedWorkflowStep,
  WorkflowStepType,
} from "@/lib/onboarding/applicant-workflow-types";

const WORKFLOW_TYPE_TO_LIBRARY_ID: Record<string, string> = {
  skill_qualification_assessment: "skill-qualification-assessment",
  document_upload: "document-upload",
  background_check: "background-check",
  reference_verification: "reference-verification",
};

const WORKFLOW_TYPE_TO_ONBOARDING_TYPE: Record<string, OnboardingStepType> = {
  skill_qualification_assessment: "skill_assessment",
  document_upload: "document_upload",
  background_check: "custom_question",
  reference_verification: "references",
};

const LIBRARY_ID_TO_WORKFLOW_TYPE: Record<string, WorkflowStepType> = {
  "skill-qualification-assessment": "skill_qualification_assessment",
  "document-upload": "document_upload",
  "background-check": "background_check",
  "reference-verification": "reference_verification",
  "references-collection": "reference_verification",
};

/** Sort workflow steps by builder `order`. */
export function normalizeWorkflowSteps(
  steps: PublishedWorkflowStep[]
): PublishedWorkflowStep[] {
  return steps.slice().sort((a, b) => a.order - b.order);
}

function isClientPerformedBackgroundCheck(step: PublishedWorkflowStep): boolean {
  if (step.type !== "background_check") return true;
  return step.settings.clientPerforms !== false;
}

/** Applicant-visible steps from a published workflow (excludes admin-only background checks). */
export function getApplicantWorkflowSteps(
  workflow: PublishedWorkflow
): PublishedWorkflowStep[] {
  return normalizeWorkflowSteps(workflow.steps).filter((step) => {
    if (step.type === "background_check" && step.settings.clientPerforms === true) {
      return true;
    }
    return isClientPerformedBackgroundCheck(step);
  });
}

function workflowSettingsToMetadata(settings: PublishedWorkflowStep["settings"]) {
  const useIntegrationPartner = settings.useIntegrationPartner === true;
  return {
    workflow_settings: {
      required: settings.required ?? true,
      clientPerforms: settings.clientPerforms !== false,
      useBraasPartner: useIntegrationPartner,
      notifyHrOnFail: settings.notifyHrOnFail === true,
      datePriority: typeof settings.timeline === "string" ? settings.timeline : "",
      provider:
        typeof settings.provider === "string"
          ? settings.provider === "checker"
            ? "Checker (connected)"
            : settings.provider
          : "",
      triggerAfter: typeof settings.triggerAfter === "string" ? settings.triggerAfter : "",
      notify: Array.isArray(settings.notify) ? settings.notify.join(", ") : "",
      timeline: typeof settings.timeline === "string" ? settings.timeline : "",
      conditionalLogic: "",
    },
  };
}

export function workflowStepToTenantStep(
  step: PublishedWorkflowStep,
  index: number
): TenantOnboardingStep {
  const libraryId = WORKFLOW_TYPE_TO_LIBRARY_ID[step.type] ?? "custom-step";
  const stepType = WORKFLOW_TYPE_TO_ONBOARDING_TYPE[step.type] ?? "custom_question";

  return {
    id: step.id,
    step_key: step.id.replace(/^step_/, ""),
    title: step.title,
    description: step.description || null,
    step_type: stepType,
    sort_order: step.order * 10 || (index + 1) * 10,
    is_required: step.required,
    is_enabled: true,
    metadata: {
      workflow_step_id: libraryId,
      workflow_day: step.day,
      ...workflowSettingsToMetadata(step.settings),
    },
  };
}

export function publishedWorkflowToTenantConfig(
  workflow: PublishedWorkflow,
  tenantId = workflow.tenant
) {
  const steps = getApplicantWorkflowSteps(workflow).map(workflowStepToTenantStep);
  return {
    configId: `cfg-${workflow.workflowId}-v${workflow.version}`,
    tenantId,
    version: workflow.version,
    steps,
    requiredDocuments: [],
    skillAssessments: [],
  };
}

export function tenantStepToWorkflowStep(step: TenantOnboardingStep): PublishedWorkflowStep {
  const libraryId =
    typeof step.metadata?.workflow_step_id === "string"
      ? step.metadata.workflow_step_id
      : "";
  const workflowType =
    LIBRARY_ID_TO_WORKFLOW_TYPE[libraryId] ??
    (step.step_type === "references"
      ? "reference_verification"
      : step.step_type === "skill_assessment"
        ? "skill_qualification_assessment"
        : step.step_type === "document_upload"
          ? "document_upload"
          : step.step_type);

  const rawSettings =
    step.metadata?.workflow_settings &&
    typeof step.metadata.workflow_settings === "object" &&
    !Array.isArray(step.metadata.workflow_settings)
      ? (step.metadata.workflow_settings as Record<string, unknown>)
      : {};

  return {
    id: step.id,
    type: workflowType,
    title: step.title,
    description: step.description ?? "",
    required: step.is_required,
    day:
      typeof step.metadata?.workflow_day === "number"
        ? step.metadata.workflow_day
        : Math.ceil(step.sort_order / 10),
    order: Math.ceil(step.sort_order / 10),
    settings: {
      ...rawSettings,
      useIntegrationPartner: rawSettings.useBraasPartner === true,
      provider:
        rawSettings.provider === "Checker (connected)"
          ? "checker"
          : rawSettings.provider,
    },
  };
}

export function tenantConfigToPublishedWorkflow(
  config: { version: number; steps: TenantOnboardingStep[] },
  tenant: string,
  workflowId = "worker_onboarding",
  status: PublishedWorkflow["status"] = "published"
): PublishedWorkflow {
  return {
    workflowId,
    tenant,
    version: config.version,
    status,
    steps: config.steps
      .filter((s) => s.is_enabled)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(tenantStepToWorkflowStep),
  };
}

export function workflowStepTypeFromTenantStep(step: TenantOnboardingStep): WorkflowStepType {
  return tenantStepToWorkflowStep(step).type;
}

/** Legacy hardcoded labels that must not appear unless configured in the workflow. */
export const LEGACY_STATIC_STEP_TITLES = ["Add Resume", "Add References", "Summary"] as const;

export function workflowIncludesLegacyTitle(
  workflow: PublishedWorkflow,
  title: string
): boolean {
  return getApplicantWorkflowSteps(workflow).some((s) => s.title === title);
}
