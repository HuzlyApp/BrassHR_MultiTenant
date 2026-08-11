import { describe, expect, it } from "vitest";
import {
  jobMutationSchema,
  normalizeApplicantEmail,
  validatePublishableJob,
  workflowNoMatchMessage,
} from "@/lib/jobs/validation";
import type { JobRequisitionInput } from "@/lib/jobs/types";

const validJob: JobRequisitionInput = {
  sourceType: "Internal",
  professionId: "11111111-1111-4111-8111-111111111111",
  employmentType: "W2",
  publicTitle: "Registered Nurse",
  publicDescription: "Provide excellent patient care.",
  location: "Austin, TX",
};

describe("job requisition validation", () => {
  it("allows incomplete drafts through input parsing", () => {
    const result = jobMutationSchema.safeParse({
      action: "save_draft",
      job: {
        sourceType: "Internal",
        professionId: validJob.professionId,
        employmentType: "W2",
      },
    });
    expect(result.success).toBe(true);
  });

  it("requires public fields and a workflow before publishing Internal jobs", () => {
    const errors = validatePublishableJob(
      { ...validJob, publicTitle: "", publicDescription: "", location: "" },
      null
    );
    expect(errors).toMatchObject({
      publicTitle: expect.any(String),
      publicDescription: expect.any(String),
      location: expect.any(String),
      workflowId: expect.any(String),
    });
  });

  it("does not require workflow or profession for MSP Recruit & Release publish", () => {
    const errors = validatePublishableJob(
      {
        ...validJob,
        sourceType: "MSP",
        placementType: "Recruit_and_Release",
        professionId: null,
        mspClient: "CVS Health",
        mspName: "Probationary",
        externalRequisitionId: "53534534",
        facility: "Texas City, Texas, United States",
        location: "",
        shiftType: "Full-time",
        employmentType: "Contract",
        commissionPercent: 10,
        commissionFixedAmount: 500,
      },
      null
    );
    expect(errors.workflowId).toBeUndefined();
    expect(errors.professionId).toBeUndefined();
    expect(errors.commissionPercent).toBeUndefined();
    expect(errors.location).toBeUndefined();
  });

  it("requires workflow and profession for MSP Recruit & EOR publish", () => {
    const errors = validatePublishableJob(
      {
        ...validJob,
        sourceType: "MSP",
        placementType: "Recruit_and_EOR",
        professionId: null,
        mspClient: "CVS Health",
        mspName: "Probationary",
        externalRequisitionId: "53534534",
        facility: "Texas City, Texas, United States",
        shiftType: "Full-time",
        employmentType: "W2",
      },
      null
    );
    expect(errors.workflowId).toBeDefined();
    expect(errors.professionId).toBeDefined();
  });

  it("requires commission fees for MSP Recruit & Release publish", () => {
    const errors = validatePublishableJob(
      {
        ...validJob,
        sourceType: "MSP",
        placementType: "Recruit_and_Release",
        mspClient: "CVS Health",
        mspName: "Probationary",
        externalRequisitionId: "53534534",
        facility: "Texas City, Texas, United States",
        location: "Texas City, Texas, United States",
        shiftType: "Full-time",
        employmentType: "Contract",
        commissionPercent: null,
        commissionFixedAmount: null,
      },
      null
    );
    expect(errors.commissionPercent).toBeDefined();
    expect(errors.commissionFixedAmount).toBeDefined();
  });

  it("requires MSP fields for a published MSP job", () => {
    const errors = validatePublishableJob(
      {
        ...validJob,
        sourceType: "MSP",
        placementType: "Recruit_and_Release",
        mspClient: "",
        mspName: "",
        externalRequisitionId: "",
        shiftType: "Full-time",
        employmentType: "Contract",
      },
      null
    );
    expect(errors.mspClient).toBe("MSP Name is required.");
    expect(errors.mspName).toBe("Contract Group / Client is required.");
    expect(errors.externalRequisitionId).toBe(
      "Internal Reference / Source Job ID is required."
    );
  });

  it("rejects uncontrolled enum variations", () => {
    const result = jobMutationSchema.safeParse({
      action: "publish",
      job: { ...validJob, employmentType: "w-2" },
    });
    expect(result.success).toBe(false);
  });

  it("normalizes applicant email without crossing tenant boundaries", () => {
    expect(normalizeApplicantEmail("  Applicant@Example.COM ")).toBe("applicant@example.com");
  });

  it("documents the matching key in no-match errors", () => {
    const message = workflowNoMatchMessage("Registered Nurse", {
      employmentType: "W2",
    });
    expect(message).toContain("Profession: Registered Nurse");
    expect(message).toContain("Employment Type: W2");
    expect(message).toContain("Ask an administrator to create a workflow mapping");
  });
});
