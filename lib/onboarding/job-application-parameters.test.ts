import { describe, expect, it } from "vitest";
import { isParameterizedJobApplicationStepType } from "@/lib/onboarding/job-application-parameters";
import { inspectionKindForStep } from "@/lib/onboarding/candidate-workflow-step-inspection";

describe("job application parameters", () => {
  it("recognises the library step id in either spelling", () => {
    expect(isParameterizedJobApplicationStepType("parameterized-job-application")).toBe(true);
    expect(isParameterizedJobApplicationStepType("parameterized_job_application")).toBe(true);
    expect(isParameterizedJobApplicationStepType("profile_information")).toBe(false);
  });

  it("opens the step as a job application inspection instead of a generic form", () => {
    expect(
      inspectionKindForStep({ stepType: "parameterized-job-application", onboardingType: "profile_information" })
    ).toBe("job_application");
  });
});
