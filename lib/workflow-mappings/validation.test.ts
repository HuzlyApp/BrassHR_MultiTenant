import { describe, expect, it } from "vitest";
import {
  mappingSpecificity,
  pickBestMappingMatch,
  validateWorkflowCompatibility,
  type MappingCandidate,
} from "@/lib/workflow-mappings/validation";

const base = (overrides: Partial<MappingCandidate>): MappingCandidate => ({
  id: "m1",
  workflowId: "w1",
  workflowName: "Workflow",
  priority: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  employmentType: "W2",
  professionId: null,
  specialtyId: null,
  location: null,
  locationType: null,
  yearsOfExperience: null,
  ...overrides,
});

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

describe("mappingSpecificity", () => {
  it("counts configured attributes including employment type", () => {
    expect(
      mappingSpecificity({
        employmentType: "W2",
        professionId: "p1",
        specialtyId: "s1",
        locationType: "On-site",
      })
    ).toBe(4);
  });
});

describe("pickBestMappingMatch", () => {
  it("prefers the most specific matching rule", () => {
    const candidates = [
      base({
        id: "default",
        workflowId: "w-default",
        workflowName: "Default W2",
        priority: 1000,
      }),
      base({
        id: "profession",
        workflowId: "w-nursing",
        workflowName: "Nursing W2",
        professionId: "nursing",
        priority: 100,
      }),
      base({
        id: "icu",
        workflowId: "w-icu",
        workflowName: "ICU Nurse Employee Workflow",
        professionId: "nursing",
        specialtyId: "icu",
        locationType: "On-site",
        priority: 50,
      }),
    ];

    const best = pickBestMappingMatch(candidates, {
      employmentType: "W2",
      professionId: "nursing",
      specialtyId: "icu",
      locationType: "On-site",
      location: "Dallas, TX",
    });

    expect(best?.id).toBe("icu");
    expect(best?.workflowName).toBe("ICU Nurse Employee Workflow");
    expect(best?.specificity).toBe(4);
  });

  it("falls back to employment-type default when no custom rule matches", () => {
    const candidates = [
      base({
        id: "default",
        workflowId: "w-default",
        workflowName: "Default W2",
        priority: 1000,
      }),
      base({
        id: "other",
        workflowId: "w-other",
        workflowName: "Other",
        professionId: "pharmacy",
      }),
    ];

    const best = pickBestMappingMatch(candidates, {
      employmentType: "W2",
      professionId: "nursing",
      specialtyId: "icu",
    });

    expect(best?.id).toBe("default");
  });

  it("breaks equal specificity with lower priority number", () => {
    const candidates = [
      base({
        id: "a",
        workflowId: "wa",
        professionId: "nursing",
        priority: 200,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      base({
        id: "b",
        workflowId: "wb",
        professionId: "nursing",
        priority: 50,
        createdAt: "2026-01-03T00:00:00.000Z",
      }),
    ];

    const best = pickBestMappingMatch(candidates, {
      employmentType: "W2",
      professionId: "nursing",
    });

    expect(best?.id).toBe("b");
  });
});
