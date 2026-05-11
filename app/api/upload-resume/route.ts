import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { persistWorkerResumePath } from "@/lib/onboarding/persist-worker-resume-path"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"

export const runtime = "nodejs"

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
  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const applicantIdRaw = formData.get("applicantId")
  const applicantId =
    typeof applicantIdRaw === "string" ? applicantIdRaw.trim() : ""

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
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
  }

  return NextResponse.json({
    fileName: file.name,
    text,
    storagePath: objectPath,
    bucket: WORKER_RESUMES_BUCKET,
  })
}
