import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { persistWorkerResumePath } from "@/lib/onboarding/persist-worker-resume-path"
import { persistWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024)
const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200)
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

  throw new Error("Only .pdf and .docx files are supported")
}

export async function POST(req: Request) {
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
  if (file.size > MAX_RESUME_BYTES) {
    return NextResponse.json({ error: "Resume file is too large" }, { status: 400 })
  }
  if (!ALLOWED_RESUME_MIME.has(mime) && !lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
    return NextResponse.json({ error: "Only PDF and DOCX resumes are supported" }, { status: 400 })
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

  const { error: uploadError } = await supabase.storage
    .from(WORKER_RESUMES_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

  if (uploadError) {
    console.error("[upload-resume] storage upload", uploadError)
    return NextResponse.json(
      { error: uploadError.message || "Failed to store resume" },
      { status: 500 }
    )
  }

  let text: string
  try {
    text = await extractText(buffer, file)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not read resume"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (applicantId) {
    try {
      await persistWorkerResumePath(supabase, applicantId, objectPath)
    } catch (e) {
      console.error("[upload-resume] worker_requirements resume_path", e)
    }
    try {
      await persistWorkerResumeRecord(supabase, applicantId, {
        fileUrl: objectPath,
        originalFileName: file.name,
        parsedData: { text },
        parsingStatus: "completed",
      })
    } catch (e) {
      console.error("[upload-resume] worker_resumes", e)
    }
  }

  return NextResponse.json({
    fileName: file.name,
    text,
    storagePath: objectPath,
    bucket: WORKER_RESUMES_BUCKET,
  })
}
