import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache, invalidateResourceCache, invalidateTenantCache, invalidateUserCache } from "@/lib/cache"

export const runtime = "nodejs"

type Body = {
  applicantId: string
  ssn_card_path?: string | null
  drivers_license_path?: string | null
  ssn_card_front_path?: string | null
  ssn_card_back_path?: string | null
  drivers_license_front_path?: string | null
  drivers_license_back_path?: string | null
  resume_path?: string | null
  job_certificate_path?: string | null
  drug_test_results_path?: string | null
  w9_path?: string | null
}

const PATH_KEYS = [
  "ssn_card_path",
  "drivers_license_path",
  "ssn_card_front_path",
  "ssn_card_back_path",
  "drivers_license_front_path",
  "drivers_license_back_path",
] as const

const OTHER_KEYS = ["resume_path", "job_certificate_path", "drug_test_results_path", "w9_path"] as const

function normPath(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function describeErr(err: unknown, fallback = "Unexpected error"): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [e.message, e.details, e.hint]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((s) => s.trim())
    if (parts.length) return parts.join(" — ")
    if (typeof e.code === "string" && e.code.trim()) return `${fallback} (${e.code.trim()})`
  }
  try {
    return `${fallback}: ${JSON.stringify(err)}`
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)

    const requirements = await getOrSetCache(
      buildCacheKey("worker_requirements", ["user", applicantId], { status: true }),
      async () => {
        // Validate applicant has a worker row (keeps behavior aligned with other onboarding APIs)
        const { data: worker, error: wErr } = await supabase
          .from("worker")
          .select("id")
          .eq("user_id", applicantId)
          .maybeSingle()

        if (wErr) throw wErr
        if (!worker?.id) {
          // This endpoint is used by the Step 4 documents page to *read* status.
          return null
        }

        const { data, error } = await supabase
          .from("worker_requirements")
          .select("*")
          .or(`worker_id.eq.${worker.id},worker_id.eq.${applicantId}`)
          .maybeSingle()

        if (error) throw error
        return data ?? null
      },
      CACHE_TTL_SECONDS.dashboards
    )

    return NextResponse.json({ requirements })
  } catch (err: unknown) {
    console.error("[onboarding/worker-requirements] GET", err)
    const msg = describeErr(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
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

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id, tenant_id")
      .eq("user_id", applicantId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id || worker.tenant_id == null) {
      return NextResponse.json(
        { error: "Worker not found; complete Step 1 (profile) before uploading documents." },
        { status: 400 }
      )
    }

    const workerTenantId = String(worker.tenant_id)

    const { data: existingRows, error: selErr } = await supabase
      .from("worker_requirements")
      .select("id")
      // worker_requirements.worker_id should reference worker.id.
      // Fallback to applicantId to support legacy rows created with the wrong key.
      .or(`worker_id.eq.${worker.id},worker_id.eq.${applicantId}`)
      .limit(1)

    if (selErr) throw selErr

    const existing = existingRows?.[0] as { id?: string | number | null } | undefined

    const updated_at = new Date().toISOString()

    const rowPayload: Record<string, unknown> = { updated_at }
    const bodyRecord = body as Record<string, unknown>
    for (const k of PATH_KEYS) {
      if (bodyRecord[k] !== undefined) {
        rowPayload[k] = normPath(bodyRecord[k])
      }
    }
    for (const k of OTHER_KEYS) {
      if (bodyRecord[k] !== undefined) {
        rowPayload[k] = normPath(bodyRecord[k])
      }
    }

    // Fallback payload when the DB doesn't yet have the newer front/back columns.
    const legacyPayload: Record<string, unknown> = {
      updated_at,
    }
    const ssnFront = body.ssn_card_front_path
    const ssnSingle = body.ssn_card_path
    if (ssnFront !== undefined || ssnSingle !== undefined) {
      legacyPayload.ssn_card_path = normPath(ssnFront ?? ssnSingle ?? null)
    }
    const dlFront = body.drivers_license_front_path
    const dlSingle = body.drivers_license_path
    if (dlFront !== undefined || dlSingle !== undefined) {
      legacyPayload.drivers_license_path = normPath(dlFront ?? dlSingle ?? null)
    }
    for (const k of OTHER_KEYS) {
      if (bodyRecord[k] !== undefined) {
        legacyPayload[k] = normPath(bodyRecord[k])
      }
    }

    const isMissingColumnErr = (e: unknown) => {
      const err = e as { code?: string; message?: string } | null
      if (!err) return false
      if (err.code === "42703") return true // Postgres undefined_column
      return typeof err.message === "string" && err.message.includes(" does not exist")
    }

    if (existing?.id != null) {
      let { error: upErr } = await supabase.from("worker_requirements").update(rowPayload).eq("id", existing.id)

      if (upErr && isMissingColumnErr(upErr)) {
        ;({ error: upErr } = await supabase.from("worker_requirements").update(legacyPayload).eq("id", existing.id))
      }

      if (upErr) {
        console.error("[onboarding/worker-requirements] update", upErr)
        const msg = [upErr.message, upErr.details, upErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    } else {
      let { error: insErr } = await supabase.from("worker_requirements").insert({
        tenant_id: workerTenantId,
        worker_id: worker.id,
        ...rowPayload,
      })

      if (insErr && isMissingColumnErr(insErr)) {
        ;({ error: insErr } = await supabase.from("worker_requirements").insert({
          tenant_id: workerTenantId,
          worker_id: worker.id,
          ...legacyPayload,
        }))
      }

      if (insErr) {
        console.error("[onboarding/worker-requirements] insert", insErr)
        const msg = [insErr.message, insErr.details, insErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    }

    await Promise.all([
      invalidateResourceCache("worker_requirements", String(worker.id)),
      invalidateTenantCache("worker_requirements", workerTenantId),
      invalidateUserCache("worker_requirements", applicantId),
      invalidateResourceCache("worker", String(worker.id)),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("[onboarding/worker-requirements]", err)
    const msg = describeErr(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
