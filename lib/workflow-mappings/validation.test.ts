import { describe, expect, it } from "vitest";
import { validateWorkflowCompatibility } from "@/lib/workflow-mappings/validation";

describe("validateWorkflowCompatibility", () => {
  it("rejects draft workflows", () => {
    expect(
      validateWorkflowCompatibility(
        { employmentType: "W2" },
        { id: "1", tenantId: "t1", name: "Draft", status: "draft", employmentType: "W2" }
      )
    ).toContain("published");
  });

  it("rejects mapping W2 criteria to a 1099-only workflow", () => {
    expect(
      validateWorkflowCompatibility(
        { employmentType: "W2" },
        { id: "1", tenantId: "t1", name: "1099 Flow", status: "published", employmentType: "1099" }
      )
    ).toContain("1099");
  });

  it("rejects mapping 1099 criteria to a W2-only workflow", () => {
    expect(
      validateWorkflowCompatibility(
        { employmentType: "1099" },
        { id: "1", tenantId: "t1", name: "W2 Flow", status: "published", employmentType: "W2" }
      )
    ).toContain("W2");
  });

  it("allows compatible or untyped workflows", () => {
    expect(
      validateWorkflowCompatibility(
        { employmentType: "W2" },
        { id: "1", tenantId: "t1", name: "Generic", status: "published", employmentType: null }
      )
    ).toBeNull();
  });
});
