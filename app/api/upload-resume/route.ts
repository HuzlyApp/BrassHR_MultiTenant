import { randomUUID } from "node:crypto"
import { after, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { persistWorkerResumePath } from "@/lib/onboarding/persist-worker-resume-path"
import { persistWorkerResumeRecord } from "@/lib/onboarding/persist-worker-resume-record"
import { resolveOrEnsureWorkerForApplicant, resolveWorkerByApplicantId, type WorkerContext } from "@/lib/onboarding/resolve-worker-context"
import { runResumeParseJob } from "@/lib/resume/run-resume-parse-job"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024)
const STORAGE_UPLOAD_TIMEOUT_MS = Number(process.env.RESUME_STORAGE_UPLOAD_TIMEOUT_MS ?? 45_000)
const RESUME_DB_TIMEOUT_MS = Number(process.env.RESUME_DB_TIMEOUT_MS ?? 6_000)
const WORKER_ENSURE_TIMEOUT_MS = Number(process.env.RESUME_WORKER_ENSURE_TIMEOUT_MS ?? 15_000)
const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
])

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200)
}

function resolveFileType(file: Pick<File, "name" | "type">): string {
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer)
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

async function resolveWorkerForUpload(
  supabase: ReturnType<typeof createClient>,
  applicantId: string,
  tenantSlug: string,
  workerIdHint: string,
  tenantIdHint: string,
): Promise<WorkerContext | null> {
  if (workerIdHint && tenantIdHint) {
    return { workerId: workerIdHint, tenantId: tenantIdHint, userId: applicantId }
  }

  const existing = await resolveWorkerByApplicantId(supabase, applicantId)
  if (existing) return existing

  return resolveOrEnsureWorkerForApplicant(supabase, applicantId, tenantSlug || null)
}

async function extractText(buffer: Buffer, file: Pick<File, "name" | "type">): Promise<string> {
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
  const tenantSlugRaw = formData.get("tenantSlug")
  const tenantSlug =
    typeof tenantSlugRaw === "string" ? tenantSlugRaw.trim().toLowerCase() : ""
  const workerIdHint =
    typeof formData.get("workerId") === "string" ? String(formData.get("workerId")).trim() : ""
  const tenantIdHint =
    typeof formData.get("tenantId") === "string" ? String(formData.get("tenantId")).trim() : ""

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
  }
  if (!applicantId) {
    return NextResponse.json({ error: "Applicant session is required before uploading a resume" }, { status: 400 })
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
  const workerTimer = createTimer()
  logResumeTiming("upload-resume", "worker-ensure-start", {
    applicantId,
    tenantSlug,
    workerIdHint: workerIdHint || null,
  })

  let workerCtx: WorkerContext | null = null
  try {
    workerCtx = await withTimeout(
      resolveWorkerForUpload(supabase, applicantId, tenantSlug, workerIdHint, tenantIdHint),
      workerIdHint || tenantIdHint ? RESUME_DB_TIMEOUT_MS : WORKER_ENSURE_TIMEOUT_MS,
      "Worker profile setup",
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Worker profile setup timed out"
    console.error("[upload-resume] worker ensure", msg)
    return NextResponse.json({ error: msg }, { status: 504 })
  }

  const workerEnsureMs = workerTimer.elapsedMs()
  logResumeTiming("upload-resume", "worker-ensure-complete", {
    workerEnsureMs,
    workerId: workerCtx?.workerId ?? null,
    tenantId: workerCtx?.tenantId ?? null,
  })

  if (!workerCtx) {
    return NextResponse.json(
      { error: "Could not create applicant profile for resume upload. Check the tenant link and try again." },
      { status: 400 },
    )
  }

  const folder = applicantId
  const objectPath = `${folder}/${randomUUID()}-${sanitizeFileName(file.name)}`

  const storageTimer = createTimer()
  let uploadError: { message?: string } | null = null
  try {
    logResumeTiming("upload-resume", "storage-start", {
      fileType,
      fileSizeBytes,
      objectPath,
    })
    const uploadResult = await withTimeout(
      supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .upload(objectPath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        }),
      STORAGE_UPLOAD_TIMEOUT_MS,
      "Resume storage upload",
    )
    uploadError = uploadResult.error
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resume storage upload timed out"
    console.error("[upload-resume] storage upload timeout", msg)
    return NextResponse.json({ error: msg }, { status: 504 })
  }
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

  const extractionTimer = createTimer()
  let text: string
  try {
    logResumeTiming("upload-resume", "extraction-start", {
      fileType,
      fileSizeBytes,
      objectPath,
    })
    text = await extractText(buffer, { name: file.name, type: file.type || "application/octet-stream" })
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

  let resumeId: string | null
  const parseStartedAt = new Date().toISOString()

  try {
    const dbTimer = createTimer()
    logResumeTiming("upload-resume", "db-write-start", {
      workerId: workerCtx.workerId,
      tenantId: workerCtx.tenantId,
      textLength,
    })
    await withTimeout(
      persistWorkerResumePath(supabase, applicantId, objectPath),
      RESUME_DB_TIMEOUT_MS,
      "Resume path persistence",
    )
    resumeId = await withTimeout(
      persistWorkerResumeRecord(supabase, applicantId, {
        fileUrl: objectPath,
        originalFileName: file.name,
        parsedData: { text },
        parsingStatus: "processing",
        textLength,
        extractionMs,
        parseStartedAt,
        fileType,
        fileSizeBytes,
        extractedText: text,
      }),
      RESUME_DB_TIMEOUT_MS,
      "Resume record persistence",
    )
    logResumeTiming("upload-resume", "db-write-complete", {
      dbWriteMs: dbTimer.elapsedMs(),
      resumeId,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save resume record"
    console.error("[upload-resume] worker_resumes", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  if (!resumeId) {
    return NextResponse.json(
      { error: "Resume was uploaded but the resume database record was not created." },
      { status: 500 },
    )
  }

  const capturedResumeId = resumeId
  if (text.trim()) {
    after(async () => {
      logResumeTiming("upload-resume", "ai-parse-enqueued", {
        resumeId: capturedResumeId,
        textLength,
      })
      await runResumeParseJob({ supabase, resumeId: capturedResumeId, text })
    })
  }

  const totalMs = routeTimer.elapsedMs()
  logResumeTiming("upload-resume", "response", {
    totalMs,
    storageUploadMs,
    workerEnsureMs,
    extractionMs,
    textLength,
    fileType,
    fileSizeBytes,
    resumeId: capturedResumeId,
    parseStatus: "processing",
  })

  return NextResponse.json({
    resumeId: capturedResumeId,
    fileName: file.name,
    storagePath: objectPath,
    parseStatus: "processing",
    bucket: WORKER_RESUMES_BUCKET,
    textLength,
    extractionMs,
  })
}
