import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { isDraftPreviewApplicantId } from "@/lib/onboarding/is-draft-preview"
import { resolveOrEnsureWorkerForApplicant } from "@/lib/onboarding/resolve-worker-context"
import { resolveOnboardingTenantId } from "@/lib/tenant/resolve-onboarding-tenant-id"
import {
  isReferenceComplete,
  MIN_COMPLETE_REFERENCES,
  type ReferenceRow,
} from "@/lib/referencesValidation"

export const runtime = "nodejs"

type ReferenceInput = Partial<ReferenceRow>

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      applicantId?: string
      tenantSlug?: string
      minCount?: number
      references?: ReferenceInput[]
    }
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    const references = Array.isArray(body.references) ? body.references : []
    const minCountRaw = Number(body.minCount)
    const minCount =
      Number.isFinite(minCountRaw) && minCountRaw > 0
        ? Math.floor(minCountRaw)
        : MIN_COMPLETE_REFERENCES

    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }
    if (isDraftPreviewApplicantId(applicantId)) {
      return NextResponse.json({ ok: true, preview: true, count: references.length })
    }
    const rowsInput = references as ReferenceRow[]
    const completeOnly = rowsInput.filter(isReferenceComplete)
    if (completeOnly.length < minCount) {
      return NextResponse.json(
        {
          error: `At least ${minCount} complete reference${minCount === 1 ? " is" : "s are"} required.`,
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

    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : ""
    if (!tenantSlug) {
      return NextResponse.json(
        { error: "Missing tenant context. Re-open your application link and try again." },
        { status: 400 },
      )
    }

    const tenantRes = await resolveOnboardingTenantId(supabase, tenantSlug)
    if (!tenantRes.ok) {
      return NextResponse.json(
        { error: tenantRes.error, code: "MISSING_TENANT" },
        { status: 503 },
      )
    }

    const worker = await resolveOrEnsureWorkerForApplicant(supabase, applicantId, tenantSlug)

    if (!worker?.workerId || !worker.tenantId) {
      return NextResponse.json(
        {
          error:
            "Worker profile not found for this session. Complete an earlier onboarding step first, then try again.",
        },
        { status: 404 },
      )
    }

    if (worker.tenantId !== tenantRes.tenantId) {
      return NextResponse.json({ error: "Tenant mismatch." }, { status: 403 })
    }

    const workerId = worker.workerId
    const tenantId = worker.tenantId

    const { error: delErr } = await supabase
      .from("worker_references")
      .delete()
      .eq("worker_id", workerId)
      .eq("tenant_id", tenantId)
    if (delErr) {
      // Older schemas may lack tenant_id — fall back to worker-scoped delete.
      const { error: delFallback } = await supabase
        .from("worker_references")
        .delete()
        .eq("worker_id", workerId)
      if (delFallback) {
        console.error("[onboarding/worker-references] delete existing", delErr, delFallback)
        throw delFallback
      }
    }

    const rows = completeOnly.map((r) => {
      const yearsRaw = String(r.yearsKnown ?? "").trim()
      const yearsKnown = yearsRaw ? Number(yearsRaw) : null
      return {
        tenant_id: tenantId,
        worker_id: workerId,
        reference_first_name: String(r.first ?? "").trim(),
        reference_last_name: String(r.last ?? "").trim(),
        reference_phone: String(r.phone ?? "").trim() || null,
        reference_email: String(r.email ?? "").trim(),
        relationship: String(r.relationship ?? "").trim() || null,
        company: String(r.company ?? "").trim() || null,
        job_title: String(r.jobTitle ?? "").trim() || null,
        years_known:
          yearsKnown != null && Number.isFinite(yearsKnown) ? yearsKnown : null,
        notes: String(r.notes ?? "").trim() || null,
      }
    })

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
