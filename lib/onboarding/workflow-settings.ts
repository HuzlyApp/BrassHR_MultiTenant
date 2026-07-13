import type { StepSettings } from "@/app/components/workflow-builder/types";
import { evaluateConditionalLogic } from "@/lib/onboarding/evaluate-conditional-logic";
import { normalizeWorkflowNodeSettings } from "@/lib/onboarding/normalize-workflow-settings";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";
import { CONVERT_TO_WORKER_STEP_ID } from "@/lib/job-requisitions/types";

export type ParsedWorkflowSettings = StepSettings & {
  /** Admin-only settings are not applied on the worker path. */
  adminOnly: boolean;
};

export function getWorkflowSettings(step: TenantOnboardingStep): ParsedWorkflowSettings {
  const raw = step.metadata?.workflow_settings;
  const base = normalizeWorkflowNodeSettings(
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Partial<StepSettings>) : null,
    { required: step.is_required }
  );

  const conditional = evaluateConditionalLogic(base.conditionalLogic);

  return {
    ...base,
    required: step.is_required ?? base.required,
    adminOnly: conditional.hideFromApplicant,
  };
}

/** Integration-backed steps use the configured provider when partner mode is on. */
export function isIntegrationPartnerStep(step: TenantOnboardingStep): boolean {
  const settings = getWorkflowSettings(step);
  return settings.useBraasPartner === true;
}

export function integrationProviderLabel(step: TenantOnboardingStep): string | null {
  const settings = getWorkflowSettings(step);
  if (!settings.useBraasPartner) return null;
  const label = settings.provider?.trim();
  return label || null;
}

/** Worker-facing steps must be performed by the applicant when clientPerforms is true (default). */
export function isWorkerPerformableStep(step: TenantOnboardingStep): boolean {
  const settings = getWorkflowSettings(step);
  if (settings.clientPerforms === false) {
    return false;
  }
  return true;
}

/**
 * Basic visibility: hide steps explicitly marked as admin-only via conditionalLogic prefix.
 * Full expression evaluation is not supported yet.
 */
export function isWorkerVisibleStep(step: TenantOnboardingStep): boolean {
  const workflowStepId =
    typeof step.metadata?.workflow_step_id === "string"
      ? step.metadata.workflow_step_id
      : step.step_key;
  if (
    workflowStepId === CONVERT_TO_WORKER_STEP_ID ||
    step.step_key === "convert_to_worker" ||
    step.step_key === "convert-to-worker"
  ) {
    return false;
  }
  const settings = getWorkflowSettings(step);
  if (settings.adminOnly) return false;
  return isWorkerPerformableStep(step);
}

/** Whether conditional logic requests pausing the flow when this step fails. */
export function shouldPauseFlowOnStepFailure(step: TenantOnboardingStep): boolean {
  const settings = getWorkflowSettings(step);
  return evaluateConditionalLogic(settings.conditionalLogic).pauseFlowOnFail;
}

export function workflowSettingsAdminHints(step: TenantOnboardingStep): string[] {
  const settings = getWorkflowSettings(step);
  const hints: string[] = [];
  if (settings.useBraasPartner) hints.push("Uses Braas partner integration (admin-managed).");
  if (settings.notifyHrOnFail) hints.push("HR is notified on failure.");
  if (settings.provider?.trim()) hints.push(`Provider: ${settings.provider.trim()}`);
  if (settings.timeline?.trim()) hints.push(`Timeline: ${settings.timeline.trim()}`);
  if (settings.triggerAfter?.trim()) hints.push(`Runs after: ${settings.triggerAfter.trim()}`);
  const logic = settings.conditionalLogic?.trim();
  if (logic && !logic.toLowerCase().startsWith("admin only")) {
    hints.push(`Note: ${logic}`);
  }
  return hints;
}

export function listUnsupportedBuilderSettings(): string[] {
  return [
    "Arbitrary conditional expressions (only admin-only / hide-from-applicant / pause-on-fail phrases).",
    "Checker partner requires CHECKER_PARTNER_API_URL; third-party requires WORKFLOW_PARTNER_WEBHOOK_URL.",
  ];
}
