import { DRAG_DATA_TYPE } from "./constants";
import type { StepDefinition, WorkflowStepDragPayload } from "./types";

export function buildWorkflowStepDragPayload(
  step: Pick<StepDefinition, "id" | "label">
): WorkflowStepDragPayload {
  return {
    stepDefinitionId: step.id,
    stepKey: step.id,
    name: step.label,
  };
}

export function writeWorkflowStepDragData(
  dataTransfer: DataTransfer,
  step: Pick<StepDefinition, "id" | "label">
): void {
  const payload = buildWorkflowStepDragPayload(step);
  dataTransfer.setData(DRAG_DATA_TYPE, JSON.stringify(payload));
  dataTransfer.setData("text/plain", step.id);
  dataTransfer.effectAllowed = "copy";
}

export function parseWorkflowStepDragPayload(
  raw: string | null | undefined
): WorkflowStepDragPayload | null {
  if (!raw || !raw.trim()) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<WorkflowStepDragPayload>;
    if (parsed && typeof parsed.stepDefinitionId === "string" && parsed.stepDefinitionId) {
      return {
        stepDefinitionId: parsed.stepDefinitionId,
        stepKey:
          typeof parsed.stepKey === "string" && parsed.stepKey
            ? parsed.stepKey
            : parsed.stepDefinitionId,
        name: typeof parsed.name === "string" ? parsed.name : parsed.stepDefinitionId,
      };
    }
  } catch {
    // Plain library id from older payloads.
  }

  const id = raw.trim();
  return { stepDefinitionId: id, stepKey: id, name: id };
}

export function readWorkflowStepDragPayload(
  dataTransfer: DataTransfer
): WorkflowStepDragPayload | null {
  const custom = dataTransfer.getData(DRAG_DATA_TYPE);
  if (custom) return parseWorkflowStepDragPayload(custom);
  return parseWorkflowStepDragPayload(dataTransfer.getData("text/plain"));
}

export function isWorkflowStepDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types ?? []).includes(DRAG_DATA_TYPE);
}
