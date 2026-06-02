import type { WorkflowNodeData } from "@/app/components/workflow-builder/types";
import {
  dayFromDatePriority,
  normalizeWorkflowNodeSettings,
} from "@/lib/onboarding/normalize-workflow-settings";

/** Apply a settings-panel patch and keep `required`, `day`, and `settings` aligned. */
export function applyWorkflowNodeDataPatch(
  data: WorkflowNodeData,
  patch: Partial<WorkflowNodeData>
): WorkflowNodeData {
  const required = patch.required ?? data.required;

  let settings = data.settings;
  if (patch.settings) {
    settings = normalizeWorkflowNodeSettings(
      { ...data.settings, ...patch.settings },
      {
        required,
        ...(patch.day !== undefined ? { day: patch.day } : {}),
      }
    );
  } else if (patch.required !== undefined || patch.day !== undefined) {
    settings = normalizeWorkflowNodeSettings(data.settings, {
      required,
      ...(patch.day !== undefined ? { day: patch.day } : {}),
    });
  }

  const resolvedDay = dayFromDatePriority(settings.datePriority);

  return {
    ...data,
    ...patch,
    label: patch.label !== undefined ? patch.label : data.label,
    description: patch.description !== undefined ? patch.description : data.description,
    required: settings.required,
    day: resolvedDay,
    settings,
  };
}
