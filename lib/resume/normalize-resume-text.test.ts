import { describe, expect, it } from "vitest"
import {
  buildGrokResumeSnippet,
  grokSnippetIsReduced,
  preExtractResumeFields,
} from "@/lib/resume/normalize-resume-text"

describe("preExtractResumeFields", () => {
  it("captures email and phone from resume text", () => {
    const text = `
Jane Doe
Registered Nurse
123 Main Street, Austin TX 78701
jane.doe@example.com
(512) 555-0199
`.trim()

    const fields = preExtractResumeFields(text)
    expect(fields.email).toBe("jane.doe@example.com")
    expect(fields.phone).toMatch(/512.*555.*0199/)
    expect(fields.first_name).toBe("Jane")
    expect(fields.last_name).toBe("Doe")
    expect(fields.zip).toBe("78701")
  })

  it("repairs gmail.cor OCR typos in extracted emails", () => {
    const fields = preExtractResumeFields(`
Pragathi Korrapati
Syracuse, NY
korrapatipragathi2709@gmail.cor
+1 (315) 316-2771
Senior Full Stack .Net Developer
`.trim())

    expect(fields.email).toBe("korrapatipragathi2709@gmail.com")
    expect(fields.city).toBe("Syracuse")
    expect(fields.state).toBe("NY")
  })
})

describe("buildGrokResumeSnippet", () => {
  it("reduces long resumes below the full text length", () => {
    const filler = "Experience line with no contact hints. ".repeat(400)
    const text = `John Smith\nCNA\njohn@example.com\n555-123-4567\n${filler}`

    const snippet = buildGrokResumeSnippet(text, 3500)
    expect(snippet.length).toBeLessThanOrEqual(3500)
    expect(grokSnippetIsReduced(text, snippet)).toBe(true)
    expect(snippet).toContain("john@example.com")
  })
})
