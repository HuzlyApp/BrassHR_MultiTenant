import { describe, expect, it } from "vitest"
import {
  PDF_MANUAL_REVIEW_RESULT,
  buildDocumentVerificationPrompt,
  parseDocumentVerificationResult,
  pdfManualReviewIfNeeded,
} from "./document-verification"

describe("document-verification", () => {
  it("builds prompt with document type", () => {
    const prompt = buildDocumentVerificationPrompt("Nursing License")
    expect(prompt).toContain("type: Nursing License")
    expect(prompt).toContain('"status": "valid"')
  })

  it("parses valid JSON response", () => {
    const raw = `{"status":"valid","verdict":"Verified","detail":"Document appears authentic and legible."}`
    expect(parseDocumentVerificationResult(raw)).toEqual({
      status: "valid",
      verdict: "Verified",
      detail: "Document appears authentic and legible.",
    })
  })

  it("flags PDF for manual review", () => {
    expect(pdfManualReviewIfNeeded({ fileName: "resume.pdf" })).toEqual(
      PDF_MANUAL_REVIEW_RESULT
    )
    expect(pdfManualReviewIfNeeded({ mimeType: "application/pdf" })).toEqual(
      PDF_MANUAL_REVIEW_RESULT
    )
    expect(pdfManualReviewIfNeeded({ fileName: "license.jpg" })).toBeNull()
  })
})
