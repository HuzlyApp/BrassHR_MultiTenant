import { isPdfFile } from "@/lib/document-upload-helpers"
import {
  PDF_MANUAL_REVIEW_RESULT,
  type DocumentVerificationResult,
} from "@/lib/document-verification"

export type ScanDocumentInput = {
  documentType: string
  file?: File | null
  fileUrl?: string | null
  fileName?: string
}

async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 = btoa(binary)
  const mime = file.type || "image/jpeg"
  return `data:${mime};base64,${base64}`
}

export async function scanUploadedDocument(
  input: ScanDocumentInput
): Promise<DocumentVerificationResult> {
  const fileName = input.fileName ?? input.file?.name

  if (isPdfFile(input.file ?? null, fileName, input.fileUrl)) {
    return PDF_MANUAL_REVIEW_RESULT
  }

  const payload: Record<string, string> = {
    documentType: input.documentType,
  }

  if (input.file && input.file.type.startsWith("image/")) {
    payload.imageBase64 = await fileToDataUrl(input.file)
    payload.mimeType = input.file.type
    payload.fileName = input.file.name
  } else if (input.fileUrl) {
    payload.fileUrl = input.fileUrl
    if (fileName) payload.fileName = fileName
  } else if (input.file) {
    return PDF_MANUAL_REVIEW_RESULT
  } else {
    throw new Error("No file or URL to scan")
  }

  const res = await fetch("/api/verify-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  const json = (await res.json().catch(() => ({}))) as DocumentVerificationResult & {
    error?: string
  }

  if (!res.ok) {
    throw new Error(json.error || "Document scan failed")
  }

  return json
}
