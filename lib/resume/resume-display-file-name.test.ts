import { describe, expect, it } from "vitest";
import { resumeDisplayFileName } from "./resume-display-file-name";

describe("resumeDisplayFileName", () => {
  it("builds canonical First_Last_resume.ext from worker name", () => {
    expect(
      resumeDisplayFileName(
        "tenant/workers/6388748d-aaaa-bbbb-cccc-ddddeeeeffff-QA_TEST_Applicant_Two.pdf",
        { first_name: "QA-TEST", last_name: "Applicant Two" }
      )
    ).toBe("QA_TEST_Applicant_Two_resume.pdf");
  });

  it("strips UUID prefix when worker name is missing", () => {
    expect(
      resumeDisplayFileName(
        "6388748d-1111-4111-8111-111111111111-QA_TEST_Applicant_Two.pdf"
      )
    ).toBe("QA_TEST_Applicant_Two.pdf");
  });
});
