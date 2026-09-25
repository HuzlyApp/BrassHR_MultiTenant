import { describe, expect, it } from "vitest"
import {
  assessCandidateName,
  normalizePersonName,
  validateCandidateNameParts,
  validatePersonName,
} from "@/lib/resume/validate-person-name"

describe("normalizePersonName", () => {
  it("trims, collapses spaces, and straightens smart punctuation", () => {
    expect(normalizePersonName("  O\u2019Connor  ")).toBe("O'Connor")
    expect(normalizePersonName("Jean\u2013Luc")).toBe("Jean-Luc")
    expect(normalizePersonName("Mary\u00A0\u00A0Jane")).toBe("Mary Jane")
  })

  it("strips zero-width characters", () => {
    expect(normalizePersonName("Jo\u200Bhn")).toBe("John")
  })
})

describe("validatePersonName — FSD examples", () => {
  const pass = [
    "Mary Jane Watson",
    "Jean-Luc Picard",
    "O'Connor",
    "O\u2019Connor",
    "José García",
    "St. John",
    "Robert Jr.",
    "Smith, Jr.",
  ]

  for (const name of pass) {
    it(`PASS: ${JSON.stringify(name)}`, () => {
      const result = validatePersonName(name)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.normalized.length).toBeGreaterThanOrEqual(2)
    })
  }

  const fail: Array<[string, string]> = [
    ["John Smith linkedin.com/in/john", "URL"],
    ["Jane Doe 919-555-1234", "phone"],
    ["jane@email.com", "email"],
    ["https://linkedin.com/in/x", "URL"],
    ["O'", "apostrophe"],
    ["-Smith", "hyphen"],
    ["", "empty"],
    ["...", "punctuation"],
    ["12345", "digits"],
    ["(Johnny) Smith", "parentheses"],
  ]

  for (const [name, why] of fail) {
    it(`FAIL (${why}): ${JSON.stringify(name)}`, () => {
      expect(validatePersonName(name).ok).toBe(false)
    })
  }
})

describe("assessCandidateName", () => {
  it("flags polluted header extracts for review", () => {
    const assessment = assessCandidateName({
      firstName: "John Smith",
      lastName: "linkedin.com/in/john",
    })
    expect(assessment.ok).toBe(false)
    expect(assessment.needsReview).toBe(true)
    expect(assessment.rawExtract).toContain("linkedin")
  })

  it("accepts clean first + last", () => {
    const assessment = assessCandidateName({
      firstName: "José",
      lastName: "García",
    })
    expect(assessment.ok).toBe(true)
    expect(assessment.needsReview).toBe(false)
    expect(assessment.normalized).toBe("José García")
  })
})

describe("validateCandidateNameParts", () => {
  it("requires both first and last to pass", () => {
    expect(validateCandidateNameParts("Jane", "Doe").ok).toBe(true)
    expect(validateCandidateNameParts("Jane", "").ok).toBe(false)
    expect(validateCandidateNameParts("jane@x.com", "Doe").ok).toBe(false)
  })

  it("allows a single-letter last initial", () => {
    expect(validateCandidateNameParts("Goutham", "K").ok).toBe(true)
  })
})
