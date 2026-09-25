import { describe, expect, it } from "vitest"
import { normalizeParsedResume } from "@/lib/resumeParseQuality"
import {
  buildGrokResumeSnippet,
  grokSnippetIsReduced,
  parseNameAndTitle,
  preExtractResumeFields,
  repairExtractedResumeText,
  sanitizeParsedIdentityFields,
  sanitizeParsedIdentityFieldsWithAssessment,
} from "@/lib/resume/normalize-resume-text"

const GOUTHAM_HEADER = `
Goutham Sr SAP Consultant kgouthamk81@gmail.com| 9752078020 | https://www.linkedin.com/in/kgoutham-k-391b78435/

Professional Summary

Served as a Senior SAP Consultant delivering SAP ECC and S/4HANA application enhancements
across MM, SD, FI/CO, ABAP, BW, and SAP Ariba in a healthcare enterprise environment.
`.trim()

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

  it("extracts City, ST and City, StateName from header lines", () => {
    expect(
      preExtractResumeFields(`
Goutham K
Senior SAP Consultant
Raleigh, NC
kgouthamk81@gmail.com
9752078020
`.trim()).city
    ).toBe("Raleigh")
    expect(
      preExtractResumeFields(`
Goutham K
Senior SAP Consultant
Raleigh, NC
kgouthamk81@gmail.com
9752078020
`.trim()).state
    ).toBe("NC")

    const fullNameState = preExtractResumeFields(`
Goutham K
Los Angeles, California
kgouthamk81@gmail.com
`.trim())
    expect(fullNameState.city).toBe("Los Angeles")
    expect(fullNameState.state).toBe("CA")
  })

  it("extracts location when city and state are on consecutive PDF lines", () => {
    const fields = preExtractResumeFields(`
Goutham K
Sr SAP Consultant
Los Angeles
California
kgouthamk81@gmail.com
`.trim())
    expect(fields.city).toBe("Los Angeles")
    expect(fields.state).toBe("CA")
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

  it("does not treat a jammed header title and contact line as the last name", () => {
    const fields = preExtractResumeFields(GOUTHAM_HEADER, {
      fileName: "Goutham_K_SAP_Consultant.docx",
    })

    expect(fields.first_name).toBe("Goutham")
    expect(fields.last_name).toBe("K")
    expect(fields.email).toBe("kgouthamk81@gmail.com")
    expect(fields.phone).toMatch(/9752078020/)
    expect(fields.job_role).toMatch(/SAP Consultant/i)
    expect(fields.last_name).not.toMatch(/gmail|linkedin|Consultant/i)
    expect(fields.city).not.toBe("MM")
    expect(fields.state).not.toBe("SD")
  })
})

describe("repairExtractedResumeText", () => {
  it("splits name, email, phone, and LinkedIn onto separate lines", () => {
    const repaired = repairExtractedResumeText(
      "Goutham Sr SAP Consultant kgouthamk81@gmail.com| 9752078020 | https://www.linkedin.com/in/kgoutham-k-391b78435/",
    )
    expect(repaired).toContain("Goutham Sr SAP Consultant")
    expect(repaired).toContain("kgouthamk81@gmail.com")
    expect(repaired.split("\n").length).toBeGreaterThan(2)
    expect(repaired.split("\n")[0]).not.toMatch(/gmail|linkedin/i)
  })

  it("restores camelCase spaces when PDF extraction dropped them", () => {
    const mashed =
      "GouthamKSeniorSAPConsultantProfessionalSummaryHighlyskilledandresultsdrivenSAPConsultantwithovertenyearsofexperienceinimplementingconfiguringandoptimizingSAPmodulesincludingS4HANAECC".repeat(
        1,
      ) + " kgouthamk81@gmail.com"
    const repaired = repairExtractedResumeText(mashed)
    expect(repaired).toMatch(/Goutham K/)
    expect(repaired).toMatch(/Professional Summary/)
  })
})

describe("parseNameAndTitle", () => {
  it("keeps a normal two-part name", () => {
    expect(parseNameAndTitle("Jane Doe")).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      job_role: "",
    })
  })

  it("moves Sr SAP Consultant out of the last name", () => {
    expect(parseNameAndTitle("Goutham Sr SAP Consultant")).toEqual({
      first_name: "Goutham",
      last_name: "",
      job_role: "Sr SAP Consultant",
    })
  })
})

describe("sanitizeParsedIdentityFields", () => {
  it("keeps polluted header extracts as draft for recruiter review (FSD NAME-001)", () => {
    const cleaned = sanitizeParsedIdentityFields(
      normalizeParsedResume({
        first_name: "Goutham",
        last_name:
          "Sr SAP Consultant kgouthamk81@gmail.com| 9752078020 | https://www.linkedin.com/in/kgoutham-k-391b78435/",
        email: "kgouthamk81@gmail.com",
        phone: "9752078020",
        city: "MM",
        state: "SD",
        job_role: "Sr SAP Consultant",
      }),
      GOUTHAM_HEADER,
      { fileName: "Goutham_K_SAP_Consultant.docx" },
    )

    // Do not silently accept stripped junk as the official name.
    expect(cleaned.first_name).toBe("Goutham")
    expect(cleaned.last_name).toMatch(/gmail|linkedin|SAP/i)
    expect(cleaned.city).toBe("")
    expect(cleaned.state).toBe("")
  })

  it("does not strip LinkedIn junk into a silent pass — keeps raw for review", () => {
    const cleaned = sanitizeParsedIdentityFields(
      normalizeParsedResume({
        first_name: "Jane",
        last_name: "Doe linkedin.com/in/jane-doe-12345 5125550199",
        email: "jane@example.com",
        phone: "",
        job_role: "",
      }),
      "Jane Doe linkedin.com/in/jane-doe-12345 5125550199\njane@example.com",
    )

    expect(cleaned.first_name).toBe("Jane")
    expect(cleaned.last_name).toMatch(/linkedin|5125550199/i)
  })

  it("does not invent a last name from a vanity LinkedIn slug with digit noise", () => {
    const cleaned = sanitizeParsedIdentityFields(
      normalizeParsedResume({
        first_name: "Goutham",
        last_name: "",
        email: "kgouthamk81@gmail.com",
        phone: "9752078020",
        job_role: "Sr SAP Consultant",
      }),
      GOUTHAM_HEADER,
    )

    expect(cleaned.first_name).toBe("Goutham")
    expect(cleaned.last_name).toBe("")
  })

  it("still accepts clean hyphenated and accented names silently", () => {
    const cleaned = sanitizeParsedIdentityFields(
      normalizeParsedResume({
        first_name: "José",
        last_name: "García",
        email: "jose@example.com",
      }),
    )
    expect(cleaned.first_name).toBe("José")
    expect(cleaned.last_name).toBe("García")
  })
})

describe("sanitizeParsedIdentityFieldsWithAssessment", () => {
  it("flags LinkedIn junk for recruiter review", () => {
    const result = sanitizeParsedIdentityFieldsWithAssessment(
      normalizeParsedResume({
        first_name: "John Smith",
        last_name: "linkedin.com/in/john",
        email: "john@example.com",
      }),
    )
    expect(result.nameAssessment.needsReview).toBe(true)
    expect(result.nameAssessment.rawExtract).toMatch(/linkedin/i)
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
