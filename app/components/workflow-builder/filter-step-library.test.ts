import { describe, expect, it } from "vitest";
import { filterStepLibrary, flattenStepLibrary, stepMatchesSearch } from "./filter-step-library";
import type { StepCategory } from "./types";

const library: StepCategory[] = [
  {
    id: "custom-steps",
    label: "Custom Steps",
    steps: [{ id: "custom-step", label: "Custom Step", icon: null, description: "Tenant checkpoint" }],
  },
  {
    id: "document-esign",
    label: "Document & eSign",
    steps: [
      { id: "document-upload", label: "Document Upload", icon: null, description: "Request documents" },
      {
        id: "tax-forms",
        label: "Tax Forms (W-4 / State)",
        icon: null,
        description: "Collect payroll tax forms.",
        keywords: ["w4", "w-4"],
      },
      {
        id: "policy-acknowledgment",
        label: "Policy Acknowledgment",
        icon: null,
        description: "Collect policy acknowledgments.",
      },
    ],
  },
  {
    id: "application-profile",
    label: "Application & Profile",
    steps: [
      {
        id: "references-collection",
        label: "References Collection",
        icon: null,
        description: "Ask applicants to provide professional references.",
      },
      {
        id: "reference-verification",
        label: "Reference Verification",
        icon: null,
        description: "Track reference verification.",
      },
    ],
  },
];

describe("filterStepLibrary", () => {
  it("matches tax search to Tax Forms by stable id, not index", () => {
    const filtered = filterStepLibrary(library, "tax");
    const ids = flattenStepLibrary(filtered).map((s) => s.id);
    expect(ids).toEqual(["tax-forms"]);
    expect(ids).not.toContain("references-collection");
  });

  it("matches reference search without returning by list index", () => {
    const filtered = filterStepLibrary(library, "reference");
    const ids = flattenStepLibrary(filtered).map((s) => s.id);
    expect(ids).toEqual(["references-collection", "reference-verification"]);
  });

  it("matches policy by name after filtering other categories", () => {
    const filtered = filterStepLibrary(library, "policy");
    const ids = flattenStepLibrary(filtered).map((s) => s.id);
    expect(ids).toEqual(["policy-acknowledgment"]);
  });

  it("matches category and description text", () => {
    expect(stepMatchesSearch(library[1].steps[0], "document", "Document & eSign")).toBe(true);
    expect(stepMatchesSearch(library[1].steps[1], "payroll", "Document & eSign")).toBe(true);
  });

  it("keeps original step definition ids after filtering", () => {
    const filtered = filterStepLibrary(library, "policy");
    const step = filtered[0].steps[0];
    expect(step.id).toBe("policy-acknowledgment");
    expect(step.label).toBe("Policy Acknowledgment");
  });
});
