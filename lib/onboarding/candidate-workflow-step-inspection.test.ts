import { describe, expect, it } from "vitest";
import {
  inspectionKindForStep,
  resumeUploaderLabel,
  reviewerLabel,
  type StaffMember,
} from "@/lib/onboarding/candidate-workflow-step-inspection";
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

describe("resumeUploaderLabel", () => {
  const staffById = new Map<string, StaffMember>([
    ["user-admin", { name: "Test User", role: "admin" }],
    ["user-recruiter", { name: "Riya Shah", role: "recruiter" }],
  ]);
  const base = {
    workerUserId: "user-worker",
    workerId: "worker-1",
    candidateName: "Naveed Khan",
    staffById,
  };

  it("names the candidate as Applicant for their own or unattributed uploads", () => {
    expect(resumeUploaderLabel({ ...base, uploadedByUserId: "user-worker" })).toBe(
      "Naveed Khan (Applicant)"
    );
    expect(resumeUploaderLabel({ ...base, uploadedByUserId: null })).toBe("Naveed Khan (Applicant)");
  });

  it("names staff uploaders with their role", () => {
    expect(resumeUploaderLabel({ ...base, uploadedByUserId: "user-admin" })).toBe("Test User (Admin)");
    expect(resumeUploaderLabel({ ...base, uploadedByUserId: "user-recruiter" })).toBe(
      "Riya Shah (Recruiter)"
    );
  });

  it("falls back when a staff uploader can no longer be found", () => {
    expect(resumeUploaderLabel({ ...base, uploadedByUserId: "user-gone" })).toBe("Team member (Staff)");
  });
});

describe("reviewerLabel", () => {
  const staffById = new Map<string, StaffMember>([
    ["user-recruiter", { name: "Riya Shah", role: "recruiter" }],
  ]);

  it("shows the reviewer's name and role, never a raw user id", () => {
    expect(reviewerLabel("user-recruiter", "riya@example.com", staffById)).toBe("Riya Shah (Recruiter)");
    expect(reviewerLabel("user-gone", null, staffById)).toBeNull();
  });

  it("falls back to the stored reviewer name", () => {
    expect(reviewerLabel("user-gone", "Test User", staffById)).toBe("Test User");
    expect(reviewerLabel(null, null, staffById)).toBeNull();
  });
});
