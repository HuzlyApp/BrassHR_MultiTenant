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

  it("requires public fields and a workflow before publishing", () => {
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

  it("requires MSP fields for a published MSP job", () => {
    const errors = validatePublishableJob(
      { ...validJob, sourceType: "MSP", mspClient: "", externalRequisitionId: "" },
      "22222222-2222-4222-8222-222222222222"
    );
    expect(errors.mspClient).toBeTruthy();
    expect(errors.externalRequisitionId).toBeTruthy();
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
