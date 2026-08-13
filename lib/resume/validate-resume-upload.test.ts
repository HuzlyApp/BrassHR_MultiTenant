import { describe, expect, it } from "vitest";
import {
  validateExtractedResumeText,
  validateResumeUploadFile,
} from "@/lib/resume/validate-resume-upload";

describe("validateResumeUploadFile", () => {
  it("accepts pdf/docx resumes under 10MB", () => {
    expect(
      validateResumeUploadFile({
        name: "jane-doe-resume.pdf",
        type: "application/pdf",
        size: 120_000,
      })
    ).toBeNull();
  });

  it("rejects non-resume formats", () => {
    expect(
      validateResumeUploadFile({
        name: "license.png",
        type: "image/png",
        size: 20_000,
      })
    ).toMatch(/PDF, DOC, or DOCX/i);
  });
});

describe("validateExtractedResumeText", () => {
  it("accepts text that looks like a resume", () => {
    const text = `
Jane Doe
jane.doe@email.com
(555) 123-4567

Professional Summary
Experienced CNA with 5 years of experience in long-term care.

Work Experience
Caregiver — Sunrise Home Health — 2020–Present

Education
Associate Degree in Nursing

Skills
Patient care, vital signs, medication assistance
`.repeat(2);
    expect(validateExtractedResumeText(text)).toBeNull();
  });

  it("rejects empty or short text", () => {
    expect(validateExtractedResumeText("hi")).toMatch(/does not look like a resume/i);
  });

  it("rejects obvious non-resume documents", () => {
    const text = `
Form W-2 Wage and Tax Statement
Employee social security number
Employer identification number
This pay stub shows wages for the tax year.
Authorization to obtain background check consent form.
`.repeat(5);
    expect(validateExtractedResumeText(text)).toMatch(/another document|not a resume/i);
  });

  it("accepts healthcare resumes that mention TB test or drug screen", () => {
    const text = `
Hailey Sparks
hailey.sparks@email.com
(555) 987-6543

Professional Summary
Certified Nursing Assistant with experience in long-term care and rehabilitation.

Work Experience
CNA — Golden Years Care — 2021–Present
Provided patient care, vital signs, and ADL support.

Certifications
CNA license, CPR/BLS, current TB test, cleared drug screen.

Education
Nursing Assistant Program — Community College

Skills
Patient care, documentation, teamwork
`.repeat(2);
    expect(validateExtractedResumeText(text)).toBeNull();
  });
});
