import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import {
  isReferenceComplete,
  MIN_COMPLETE_REFERENCES,
  type ReferenceRow,
} from "@/lib/referencesValidation"

export const runtime = "nodejs"

type ReferenceInput = {
  first?: string
  last?: string
  phone?: string
  email?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      applicantId?: string
      references?: ReferenceInput[]
    }
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    const references = Array.isArray(body.references) ? body.references : []

    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }
    const rowsInput = references as ReferenceRow[]
    const completeOnly = rowsInput.filter(isReferenceComplete)
    if (completeOnly.length < MIN_COMPLETE_REFERENCES) {
      return NextResponse.json(
        {
          error: `At least ${MIN_COMPLETE_REFERENCES} complete references are required (first name, last name, phone, and email for each).`,
        },
        { status: 400 },
      )
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json(
        {
          error: "MISSING_SERVICE_ROLE_KEY",
          hint: "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to save references to the database.",
        },
        { status: 503 },
      )
    }

    const supabase = createClient(url, key)

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, tenant_id")
      .eq("user_id", applicantId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json(
        {
          error: "Worker profile not found for this session. Complete “Review resume details” and earlier steps first.",
        },
        { status: 404 },
      )
    }

    const workerId = worker.id as string
    const tenantId = String(worker.tenant_id)

    const { error: delErr } = await supabase.from("worker_references").delete().eq("worker_id", workerId)
    if (delErr) {
      console.error("[onboarding/worker-references] delete existing", delErr)
      throw delErr
    }

    const rows = completeOnly.map((r) => ({
      tenant_id: tenantId,
      worker_id: workerId,
      reference_first_name: String(r.first ?? "").trim(),
      reference_last_name: String(r.last ?? "").trim(),
      reference_phone: String(r.phone ?? "").trim() || null,
      reference_email: String(r.email ?? "").trim(),
    }))

    for (const row of rows) {
      if (!row.reference_first_name || !row.reference_last_name || !row.reference_email) {
        return NextResponse.json(
          { error: "Each reference must include first name, last name, and email." },
          { status: 400 },
        )
      }
    }

    const { error: insErr } = await supabase.from("worker_references").insert(rows)
    if (insErr) {
      console.error("[onboarding/worker-references] insert", insErr)
      const msg = [insErr.message, insErr.details].filter(Boolean).join(" — ")
      return NextResponse.json({ error: msg || "Failed to save references" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (err: unknown) {
    console.error("[onboarding/worker-references]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
