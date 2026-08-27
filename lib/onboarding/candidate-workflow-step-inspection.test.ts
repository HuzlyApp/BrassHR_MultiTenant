import { describe, expect, it } from "vitest";
import { inspectionKindForStep } from "@/lib/onboarding/candidate-workflow-step-inspection";
import {
  LEGACY_UNMATCHED_STEP_MESSAGE,
  STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE,
} from "@/lib/onboarding/assigned-workflow-steps";

describe("workflow step inspection kinds", () => {
  it("opens the resume, license, assessment, reference, agreement, form, and final review kinds", () => {
    expect(inspectionKindForStep({ stepType: "resume-basic-profile", onboardingType: "resume_upload" })).toBe(
      "resume"
    );
    expect(
      inspectionKindForStep({
        stepType: "credential-license-verification",
        onboardingType: "professional_license",
      })
    ).toBe("upload");
    expect(
      inspectionKindForStep({
        stepType: "skill-qualification-assessment",
        onboardingType: "skill_assessment",
      })
    ).toBe("assessment");
    expect(inspectionKindForStep({ stepType: "references-collection", onboardingType: "references" })).toBe(
      "references"
    );
    expect(inspectionKindForStep({ stepType: "employee-agreement", onboardingType: "authorizations" })).toBe(
      "agreement"
    );
    expect(inspectionKindForStep({ stepType: "custom-application-form", onboardingType: "custom_question" })).toBe(
      "form"
    );
    expect(inspectionKindForStep({ stepType: "completion-milestone", onboardingType: "review_submit" })).toBe(
      "final_review"
    );
    expect(inspectionKindForStep({ stepType: "background-check", onboardingType: "custom_question" })).toBe(
      "background_check"
    );
  });

  it("explains completed steps with no document and unmatched legacy records", () => {
    expect(STEP_COMPLETED_WITHOUT_DOCUMENT_MESSAGE).toBe(
      "Completed through candidate confirmation. No document was required."
    );
    expect(LEGACY_UNMATCHED_STEP_MESSAGE).toBe(
      "This step could not be linked to a stored submission record."
    );
  });
});
