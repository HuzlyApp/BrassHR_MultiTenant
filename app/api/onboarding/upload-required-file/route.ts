import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"

export const runtime = "nodejs"

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200)
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const folderRaw = formData.get("folder")
    const applicantIdRaw = formData.get("applicantId")
    const folder = typeof folderRaw === "string" ? folderRaw.trim() : ""
    const applicantId =
      typeof applicantIdRaw === "string" ? applicantIdRaw.trim() : ""

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }
    if (!folder) {
      return NextResponse.json({ error: "Missing folder" }, { status: 400 })
    }
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const allowedFolder = /^(ssn|license|tb|cpr|other)$/
    if (!allowedFolder.test(folder)) {
      return NextResponse.json({ error: "Invalid folder" }, { status: 400 })
    }
    console.info("[debug-doc-upload] upload-required-file:start", {
      route: "/api/onboarding/upload-required-file",
      fileName: file.name,
      documentType: folder,
      applicantId,
      bucket: WORKER_REQUIRED_FILES_BUCKET,
    })

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
    const path = `${folder}/${applicantId}/${Date.now()}-${randomUUID()}-${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(WORKER_REQUIRED_FILES_BUCKET)
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

    if (uploadError) {
      console.error("[debug-doc-upload] upload-required-file:error", {
        route: "/api/onboarding/upload-required-file",
        fileName: file.name,
        documentType: folder,
        applicantId,
        bucket: WORKER_REQUIRED_FILES_BUCKET,
        uploadedPath: path,
        error: uploadError.message,
      })
      return NextResponse.json(
        { error: uploadError.message || "Upload failed" },
        { status: 500 }
      )
    }

    const { data: urlData } = supabase.storage
      .from(WORKER_REQUIRED_FILES_BUCKET)
      .getPublicUrl(path)
    console.info("[debug-doc-upload] upload-required-file:success", {
      route: "/api/onboarding/upload-required-file",
      fileName: file.name,
      documentType: folder,
      applicantId,
      bucket: WORKER_REQUIRED_FILES_BUCKET,
      uploadedPath: path,
      generatedUrl: urlData.publicUrl,
    })

    return NextResponse.json({
      path,
      publicUrl: urlData.publicUrl,
      fileName: file.name,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
