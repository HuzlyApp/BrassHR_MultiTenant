import type { StepSettings } from "@/app/components/workflow-builder/types";
import { defaultSerializableSettings } from "@/lib/onboarding/workflow-builder-serialization";
import type { TenantOnboardingStep } from "@/lib/onboarding/types";

export type ParsedWorkflowSettings = StepSettings & {
  /** Admin-only settings are not applied on the worker path. */
  adminOnly: boolean;
};

export function getWorkflowSettings(step: TenantOnboardingStep): ParsedWorkflowSettings {
  const raw = step.metadata?.workflow_settings;
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? ({ ...defaultSerializableSettings(), ...(raw as Partial<StepSettings>) } as StepSettings)
      : defaultSerializableSettings();

  return {
    ...base,
    required: step.is_required ?? base.required,
    adminOnly: false,
  };
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
  const settings = getWorkflowSettings(step);
  const logic = (settings.conditionalLogic ?? "").trim().toLowerCase();
  if (logic.startsWith("admin only") || logic.startsWith("hide from applicant")) {
    return false;
  }
  return isWorkerPerformableStep(step);
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
    "Full conditional branching (use Publish, then verify worker routes).",
    "Automatic partner triggers (stored for admin reference only).",
  ];
}
