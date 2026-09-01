import { describe, expect, it } from "vitest"
import {
  hasAdminCandidateIdentity,
  normalizeParsedResume,
  sanitizeResumeEmail,
} from "@/lib/resumeParseQuality"

describe("sanitizeResumeEmail", () => {
  it("repairs well-known provider TLD typos from PDF extraction", () => {
    expect(sanitizeResumeEmail("korrapatipragathi2709@gmail.cor")).toBe(
      "korrapatipragathi2709@gmail.com"
    )
    expect(sanitizeResumeEmail("pat@yahoo.con")).toBe("pat@yahoo.com")
  })

  it("leaves unknown domains and valid emails unchanged", () => {
    expect(sanitizeResumeEmail("jordan.lee@clinic.org")).toBe("jordan.lee@clinic.org")
    expect(sanitizeResumeEmail("founder@mycor.com")).toBe("founder@mycor.com")
  })
})

describe("hasAdminCandidateIdentity", () => {
  it("is true when first name, last name, and email are present", () => {
    expect(
      hasAdminCandidateIdentity(
        normalizeParsedResume({
          first_name: "Pragathi",
          last_name: "Korrapati",
          email: "korrapatipragathi2709@gmail.cor",
        })
      )
    ).toBe(true)
  })

  it("is false when email is missing", () => {
    expect(
      hasAdminCandidateIdentity(
        normalizeParsedResume({
          first_name: "Pragathi",
          last_name: "Korrapati",
        })
      )
    ).toBe(false)
  })
})

describe("normalizeParsedResume", () => {
  it("strips NUL bytes from parsed names extracted from PDFs", () => {
    expect(
      normalizeParsedResume({
        first_name: "Almog\u0000",
        last_name: "Arazi",
        email: "almog@example.com",
      })
    ).toMatchObject({
      first_name: "Almog",
      last_name: "Arazi",
      email: "almog@example.com",
    })
  })
})
