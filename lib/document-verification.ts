import { extractJsonObjectFromModelText } from "@/lib/resumeParseQuality"
import { isPdfFile } from "@/lib/document-upload-helpers"

export type DocumentVerificationStatus = "valid" | "warning" | "invalid"

export type DocumentVerificationResult = {
  status: DocumentVerificationStatus
  verdict: string
  detail: string
}

export const PDF_MANUAL_REVIEW_RESULT: DocumentVerificationResult = {
  status: "warning",
  verdict: "Manual review required",
  detail:
    "PDF files cannot be scanned automatically. A recruiter must review this document manually.",
}

export function buildDocumentVerificationPrompt(documentType: string): string {
  return `You are a document verification AI for healthcare worker onboarding.
The user uploaded an image of a document (type: ${documentType}).

Analyze the image and respond ONLY with a JSON object — no markdown, no backticks:
{
  "status": "valid" | "warning" | "invalid",
  "verdict": "short 1-line verdict under 10 words",
  "detail": "1–2 sentence evaluation of authenticity, legibility, and any concerns"
}

Status rules:
- "valid" = document looks real, clear, and matches expected document type
- "warning" = minor issues (blurry, cropped, partially visible) but may still be real
- "invalid" = clearly fake, tampered, unreadable, or wrong document type entirely`
}

export function parseDocumentVerificationResult(raw: string): DocumentVerificationResult | null {
  const parsed = extractJsonObjectFromModelText(raw)
  if (!parsed) return null

  const status = parsed.status
  const verdict = typeof parsed.verdict === "string" ? parsed.verdict.trim() : ""
  const detail = typeof parsed.detail === "string" ? parsed.detail.trim() : ""

  if (status !== "valid" && status !== "warning" && status !== "invalid") return null
  if (!verdict || !detail) return null

  return { status, verdict, detail }
}

export function pdfManualReviewIfNeeded(opts: {
  file?: File | null
  fileName?: string
  mimeType?: string
  url?: string | null
}): DocumentVerificationResult | null {
  const mime = (opts.mimeType || opts.file?.type || "").toLowerCase()
  if (mime === "application/pdf") return PDF_MANUAL_REVIEW_RESULT
  if (isPdfFile(opts.file ?? null, opts.fileName, opts.url)) return PDF_MANUAL_REVIEW_RESULT
  return null
}
