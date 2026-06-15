import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { resolveOnboardingTenantId } from "@/lib/tenant/resolve-onboarding-tenant-id"
import { persistWorkerRow } from "@/lib/onboarding/persist-worker-row"
import { resumeToStep1Fields } from "@/lib/onboarding/resume-to-step1-fields"
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const existing = await resolveWorkerByApplicantId(supabase, applicantId)
    if (existing) {
      return NextResponse.json({
        ok: true,
        workerId: existing.workerId,
        tenantId: existing.tenantId,
        created: false,
      })
    }

    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : ""
    const tenantRes = await resolveOnboardingTenantId(supabase, tenantSlug || null)
    if (!tenantRes.ok) {
      return NextResponse.json(
        { error: tenantRes.error, code: "MISSING_TENANT" },
        { status: 503 }
      )
    }

    const fields = resumeToStep1Fields(body.resume ?? body, applicantId)
    const saved = await persistWorkerRow(supabase, {
      applicantId,
      tenantId: tenantRes.tenantId,
      fields,
    })

    if (!saved.ok) {
      return NextResponse.json(
        { error: saved.error, code: saved.code },
        { status: saved.status ?? 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      workerId: saved.workerId,
      tenantId: tenantRes.tenantId,
      created: true,
    })
  } catch (err: unknown) {
    console.error("[onboarding/ensure-worker]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
