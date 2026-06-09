import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { persistWorkerResumePath } from "@/lib/onboarding/persist-worker-resume-path"
import { getSupabaseUrl } from "@/lib/supabase-env"
import {
  WORKER_REQUIRED_FILES_BUCKET,
  WORKER_RESUMES_BUCKET,
} from "@/lib/supabase-storage-buckets"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

const MAX_RESUME_BYTES = Number(process.env.MAX_RESUME_UPLOAD_BYTES ?? 10 * 1024 * 1024)
const MAX_DOC_BYTES = Number(process.env.MAX_REQUIRED_FILE_UPLOAD_BYTES ?? 10 * 1024 * 1024)
const ALLOWED_RESUME_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const ALLOWED_DOC_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/jpg"])

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200)
}

type LegacyDocColumn =
  | "nursing_license_url"
  | "tb_test_url"
  | "cpr_certification_url"
  | "ssn_url"
  | "drivers_license_url"

function legacyColumnForTitle(title: string): LegacyDocColumn | null {
  const t = title.trim().toLowerCase()
  if (t.includes("nursing") && t.includes("license")) return "nursing_license_url"
  if (t.includes("tb") || t.includes("tuberculosis")) return "tb_test_url"
  if (t.includes("cpr") || t.includes("bls")) return "cpr_certification_url"
  if (t.includes("ssn") || t.includes("social security")) return "ssn_url"
  if (t.includes("driver") && t.includes("license")) return "drivers_license_url"
  if (t.includes("license")) return "nursing_license_url"
  return null
}

async function upsertLegacyWorkerDocumentUrl(
  supabase: SupabaseClient,
  workerId: string,
  tenantId: string,
  column: LegacyDocColumn,
  publicUrl: string
): Promise<void> {
  const { data: existingRows, error: selErr } = await supabase
    .from("worker_documents")
    .select("id")
    .eq("worker_id", workerId)
    .limit(1)

  if (selErr) throw selErr

  const existing = existingRows?.[0] as { id?: string } | undefined
  const updated_at = new Date().toISOString()

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {
      updated_at,
      [column]: publicUrl,
    }
    const { error } = await supabase
      .from("worker_documents")
      .update(updatePayload)
      .eq("id", existing.id)
    if (error) throw error
    return
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    worker_id: workerId,
    updated_at,
    [column]: publicUrl,
  }
  const { error: insErr } = await supabase.from("worker_documents").insert(insertPayload)
  if (insErr) throw insErr
}

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, {
      namespace: "admin-worker-attachment-upload",
      key: getClientIp(req),
      limit: Number(process.env.RATE_LIMIT_UPLOADS_PER_HOUR ?? 40),
      windowMs: 60 * 60 * 1000,
      failClosed: false,
    })
    if (limited) return limited

    const auth = await requireApiSession()
    if (auth instanceof NextResponse) return auth
    if (!isStaffRole(auth.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const workerIdRaw = String(formData.get("workerId") ?? "").trim()
    const requiredDocumentId = String(formData.get("requiredDocumentId") ?? "").trim() || null
    const documentTitle = String(formData.get("documentTitle") ?? "").trim()
    const attachmentKind = String(formData.get("attachmentKind") ?? "").trim()

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }
    const workerId = idCheck.value

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, tenant_id, user_id")
      .eq("id", workerId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    if (!canAccessWorkerRecord(auth, { id: String(worker.id), user_id: worker.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantId = String(worker.tenant_id)
    const userId =
      worker.user_id != null && String(worker.user_id).trim()
        ? String(worker.user_id).trim()
        : workerId

    const isResume = attachmentKind === "resume" || (!requiredDocumentId && documentTitle.toLowerCase().includes("resume"))

    if (isResume) {
      const lowerName = file.name.toLowerCase()
      const mime = (file.type || "").toLowerCase()
      if (file.size > MAX_RESUME_BYTES) {
        return NextResponse.json({ error: "Resume file is too large" }, { status: 400 })
      }
      if (
        !ALLOWED_RESUME_MIME.has(mime) &&
        !lowerName.endsWith(".pdf") &&
        !lowerName.endsWith(".docx")
      ) {
        return NextResponse.json({ error: "Only PDF and DOCX resumes are supported" }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const objectPath = `${userId}/${randomUUID()}-${sanitizeFileName(file.name)}`

      const { error: uploadError } = await supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .upload(objectPath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 })
      }

      await persistWorkerResumePath(supabase, userId, objectPath)

      return NextResponse.json({ ok: true, path: objectPath, bucket: WORKER_RESUMES_BUCKET })
    }

    if (!requiredDocumentId) {
      return NextResponse.json({ error: "Missing requiredDocumentId" }, { status: 400 })
    }

    const mime = (file.type || "").toLowerCase()
    if (file.size > MAX_DOC_BYTES) {
      return NextResponse.json({ error: "File is too large" }, { status: 400 })
    }
    if (mime && !ALLOWED_DOC_MIME.has(mime)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    const { data: reqDoc, error: docErr } = await supabase
      .from("tenant_required_documents")
      .select("id, tenant_id, max_file_size_mb, accepted_file_types, title")
      .eq("id", requiredDocumentId)
      .eq("tenant_id", tenantId)
      .maybeSingle()

    if (docErr) throw docErr
    if (!reqDoc) {
      return NextResponse.json({ error: "Document requirement not found" }, { status: 404 })
    }

    const maxMb = Number(reqDoc.max_file_size_mb) || 10
    const maxBytes = maxMb * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File exceeds ${maxMb}MB limit` }, { status: 400 })
    }

    const accepted = Array.isArray(reqDoc.accepted_file_types)
      ? (reqDoc.accepted_file_types as string[])
      : []
    if (accepted.length && file.type && !accepted.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed for this requirement" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const objectPath = `${tenantId}/${workerId}/${requiredDocumentId}/${randomUUID()}-${sanitizeFileName(file.name)}`

    const { error: uploadError } = await supabase.storage
      .from(WORKER_REQUIRED_FILES_BUCKET)
      .upload(objectPath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 })
    }

    const row = {
      worker_id: workerId,
      tenant_id: tenantId,
      required_document_id: requiredDocumentId,
      file_url: objectPath,
      original_file_name: file.name,
      file_type: file.type || null,
      file_size: file.size,
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from("worker_submitted_documents")
      .select("id")
      .eq("worker_id", workerId)
      .eq("required_document_id", requiredDocumentId)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase
        .from("worker_submitted_documents")
        .update(row)
        .eq("id", existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from("worker_submitted_documents").insert(row)
      if (error) throw error
    }

    const title = documentTitle || String(reqDoc.title ?? "")
    const legacyColumn = legacyColumnForTitle(title)
    if (legacyColumn) {
      const { data: urlData } = supabase.storage
        .from(WORKER_REQUIRED_FILES_BUCKET)
        .getPublicUrl(objectPath)
      await upsertLegacyWorkerDocumentUrl(
        supabase,
        workerId,
        tenantId,
        legacyColumn,
        urlData.publicUrl
      )
    }

    return NextResponse.json({ ok: true, path: objectPath, bucket: WORKER_REQUIRED_FILES_BUCKET })
  } catch (err: unknown) {
    console.error("[admin/worker-attachment-upload]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
