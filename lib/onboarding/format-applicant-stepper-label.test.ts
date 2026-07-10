import { describe, expect, it } from "vitest"
import { formatApplicantStepperLabel } from "./format-applicant-stepper-label"

describe("formatApplicantStepperLabel", () => {
  it("splits titles on slash into two lines without showing slash", () => {
    expect(formatApplicantStepperLabel("Authorization / Background Check")).toBe(
      "Authorization\nBackground Check"
    )
    expect(formatApplicantStepperLabel("Agreement / Signature")).toBe("Agreement\nSignature")
    expect(formatApplicantStepperLabel("Final Review / Completion")).toBe(
      "Final Review\nCompletion"
    )
  })

  it("splits two-word titles across two lines", () => {
    expect(formatApplicantStepperLabel("Upload Resume")).toBe("Upload\nResume")
    expect(formatApplicantStepperLabel("Skill Assessment")).toBe("Skill\nAssessment")
  })

  it("keeps single-word titles on one line", () => {
    expect(formatApplicantStepperLabel("Summary")).toBe("Summary")
  })
})
