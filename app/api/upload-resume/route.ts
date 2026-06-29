import { randomUUID } from "node:crypto"
import { after, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { persistWorkerResumePath } from "@/lib/onboarding/persist-worker-resume-path"
import { persistWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record"
import { runResumeParseJob } from "@/lib/resume/run-resume-parse-job"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024)
const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
])

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200)
}

function resolveFileType(file: File): string {
  const lower = file.name.toLowerCase()
  const mime = (file.type || "").toLowerCase()
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf"
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx"
  }
  if (mime === "application/msword" || lower.endsWith(".doc")) return "doc"
  return "unknown"
}

async function extractText(buffer: Buffer, file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  const mime = (file.type || "").toLowerCase()

  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    const pdf = await pdfParse(buffer)
    return pdf.text
  }

  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (mime === "application/msword" || lower.endsWith(".doc")) {
    throw new Error(
      "Legacy .doc files are not supported. Please save your resume as .docx or PDF."
    )
  }

  throw new Error("Only PDF, DOC, and DOCX resumes are supported")
}

export async function POST(req: Request) {
  const routeTimer = createTimer()

  const limited = await enforceRateLimit(req, {
    namespace: "upload-resume",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: false,
  })
  if (limited) return limited

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const applicantIdRaw = formData.get("applicantId")
  const applicantId =
    typeof applicantIdRaw === "string" ? applicantIdRaw.trim() : ""

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }
  const lowerName = file.name.toLowerCase()
  const mime = (file.type || "").toLowerCase()
  const fileType = resolveFileType(file)
  const fileSizeBytes = file.size

  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Resume file is too large" }, { status: 400 })
  }
  if (
    !ALLOWED_RESUME_MIME.has(mime) &&
    !lowerName.endsWith(".pdf") &&
    !lowerName.endsWith(".docx") &&
    !lowerName.endsWith(".doc")
  ) {
    return NextResponse.json({ error: "Only PDF, DOC, and DOCX resumes are supported" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase service role not configured" },
      { status: 503 }
    )
  }

  const supabase = createClient(url, key)
  const folder = applicantId || "pending"
  const objectPath = `${folder}/${randomUUID()}-${sanitizeFileName(file.name)}`

  const storageTimer = createTimer()
  const { error: uploadError } = await supabase.storage
    .from(WORKER_RESUMES_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  const storageUploadMs = storageTimer.elapsedMs()

  if (uploadError) {
    console.error("[upload-resume] storage upload", uploadError)
    return NextResponse.json(
      { error: uploadError.message || "Failed to store resume" },
      { status: 500 }
    )
  }

  logResumeTiming("upload-resume", "storage-complete", {
    storageUploadMs,
    fileType,
    fileSizeBytes,
  })

  let text: string
  const extractionTimer = createTimer()
  try {
    text = await extractText(buffer, file)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not read resume"
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const extractionMs = extractionTimer.elapsedMs()
  const textLength = text.trim().length

  logResumeTiming("upload-resume", "extraction-complete", {
    extractionMs,
    textLength,
    fileType,
    fileSizeBytes,
  })

  let resumeId: string | null = null
  const parseStartedAt = new Date().toISOString()

  if (applicantId) {
    try {
      await persistWorkerResumePath(supabase, applicantId, objectPath)
    } catch (e) {
      console.error("[upload-resume] worker_requirements resume_path", e)
    }
    try {
      resumeId = await persistWorkerResumeRecord(supabase, applicantId, {
        fileUrl: objectPath,
        originalFileName: file.name,
        parsedData: { text },
        parsingStatus: "processing",
        textLength,
        extractionMs,
        parseStartedAt,
      })
    } catch (e) {
      console.error("[upload-resume] worker_resumes", e)
    }
  }

  if (resumeId && text.trim()) {
    after(async () => {
      await runResumeParseJob({ supabase, resumeId: resumeId!, text })
    })
  }

  const totalMs = routeTimer.elapsedMs()
  logResumeTiming("upload-resume", "response", {
    totalMs,
    storageUploadMs,
    extractionMs,
    textLength,
    fileType,
    fileSizeBytes,
    resumeId,
    parseStatus: resumeId ? "processing" : "pending",
  })

  return NextResponse.json({
    resumeId,
    fileName: file.name,
    storagePath: objectPath,
    parseStatus: resumeId ? "processing" : "pending",
    bucket: WORKER_RESUMES_BUCKET,
    textLength,
    extractionMs,
  })
}
