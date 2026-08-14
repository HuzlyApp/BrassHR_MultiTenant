import { describe, expect, it } from "vitest";
import { parseWorkflowStepDragPayload } from "./workflow-step-drag";

describe("parseWorkflowStepDragPayload", () => {
  it("reads a JSON payload with a stable step definition id", () => {
    const payload = parseWorkflowStepDragPayload(
      JSON.stringify({
        stepDefinitionId: "policy-acknowledgment",
        stepKey: "policy-acknowledgment",
        name: "Policy Acknowledgment",
      })
    );
    expect(payload?.stepDefinitionId).toBe("policy-acknowledgment");
    expect(payload?.name).toBe("Policy Acknowledgment");
  });

  it("does not fall back to a default or index when given a filtered result id", () => {
    const payload = parseWorkflowStepDragPayload("tax-forms");
    expect(payload?.stepDefinitionId).toBe("tax-forms");
    expect(payload?.stepDefinitionId).not.toBe("references-collection");
  });

  it("returns null for empty input", () => {
    expect(parseWorkflowStepDragPayload("")).toBeNull();
    expect(parseWorkflowStepDragPayload(null)).toBeNull();
  });
});
