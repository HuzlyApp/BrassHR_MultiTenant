import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  findRecruitCandidateIdByEmail,
  getZohoAccessToken,
  uploadCandidateAttachment,
} from "@/lib/zoho-recruit"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseStoragePublicUrl } from "@/lib/supabase-storage-url"

export const runtime = "nodejs"

function guessMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "application/pdf"
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  return "application/octet-stream"
}

const DOC_LABELS: Record<string, string> = {
  nursing_license_url: "Nursing_License",
  tb_test_url: "TB_Test",
  cpr_certification_url: "CPR",
  ssn_url: "SSN",
  ssn_back_url: "SSN_Back",
  drivers_license_url: "Drivers_License",
  drivers_license_back_url: "Drivers_License_Back",
  document_url: "Document",
}

export async function POST(req: NextRequest) {
  try {
    const { applicantId } = await req.json()
    if (!applicantId || typeof applicantId !== "string") {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, email, first_name, last_name")
      .eq("user_id", applicantId)
      .maybeSingle()

    if (wErr) throw wErr
    const email = worker?.email?.trim()
    if (!email || !worker?.id) {
      return NextResponse.json(
        { error: "Worker email not found; complete step 1 before Zoho sync." },
        { status: 400 }
      )
    }

    const { data: docRow, error: dErr } = await supabase
      .from("worker_documents")
      .select(
        "nursing_license_url, tb_test_url, cpr_certification_url, ssn_url, ssn_back_url, drivers_license_url, drivers_license_back_url, document_url"
      )
      .eq("worker_id", worker.id)
      .maybeSingle()

    if (dErr) throw dErr

    const urlEntries: { key: string; url: string }[] = []
    for (const k of Object.keys(DOC_LABELS)) {
      const u = docRow?.[k as keyof typeof docRow] as string | null | undefined
      if (u && String(u).trim()) urlEntries.push({ key: k, url: String(u).trim() })
    }

    if (urlEntries.length === 0) {
      return NextResponse.json({ synced: 0, message: "No document URLs to sync" })
    }

    const { accessToken, apiDomain } = await getZohoAccessToken()

    const forcedId = process.env.ZOHO_RECRUIT_CANDIDATE_ID?.trim()
    const candidateId =
      forcedId || (await findRecruitCandidateIdByEmail(accessToken, apiDomain, email))

    if (!candidateId) {
      return NextResponse.json(
        {
          error:
            "No Zoho Recruit Candidate found for this email. Create the candidate in Zoho or set ZOHO_RECRUIT_CANDIDATE_ID for testing.",
        },
        { status: 404 }
      )
    }

    let synced = 0
    for (const { key, url: publicUrl } of urlEntries) {
      const parsed = parseStoragePublicUrl(publicUrl)
      if (!parsed) {
        console.warn("[zoho sync] skip unparseable URL", publicUrl)
        continue
      }

      const { data: blob, error: dlErr } = await supabase.storage.from(parsed.bucket).download(parsed.path)
      if (dlErr || !blob) {
        console.error("[zoho sync] download failed", parsed, dlErr)
        continue
      }
      const buf = Buffer.from(await blob.arrayBuffer())
      const base = parsed.path.split("/").pop() || "document"
      const label = DOC_LABELS[key] || "document"
      const fileName = `${label}_${base}`

      await uploadCandidateAttachment(accessToken, apiDomain, candidateId, fileName, buf, guessMime(parsed.path))
      synced++
    }

    return NextResponse.json({ synced, candidateId })
  } catch (err: unknown) {
    console.error("[zoho/sync-onboarding-documents]", err)
    const msg = err instanceof Error ? err.message : "Zoho sync failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
