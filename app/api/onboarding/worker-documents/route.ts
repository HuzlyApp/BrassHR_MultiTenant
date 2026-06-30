import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache, invalidateResourceCache, invalidateTenantCache, invalidateUserCache } from "@/lib/cache"
import {
  readOnboardingTenantSlugFromRequest,
  resolveOnboardingWorker,
} from "@/lib/onboarding/resolve-onboarding-worker"

export const runtime = "nodejs"

function isMissingRelationError(err: unknown) {
  const msg =
    typeof err === "string"
      ? err
      : (err as { message?: unknown; details?: unknown })?.message ??
        (err as { details?: unknown })?.details
  const s = typeof msg === "string" ? msg : ""
  return (
    /relation .* does not exist/i.test(s) ||
    /schema cache/i.test(s) ||
    /could not find the table/i.test(s)
  )
}

type Body = {
  applicantId: string
  nursing_license_url?: string | null
  tb_test_url?: string | null
  cpr_certification_url?: string | null
  ssn_url?: string | null
  ssn_back_url?: string | null
  drivers_license_url?: string | null
  drivers_license_back_url?: string | null
}

const URL_KEYS = [
  "nursing_license_url",
  "tb_test_url",
  "cpr_certification_url",
  "ssn_url",
  "ssn_back_url",
  "drivers_license_url",
  "drivers_license_back_url",
] as const

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || ""
    const tenantSlug =
      req.nextUrl.searchParams.get("tenant")?.trim().toLowerCase() ||
      readOnboardingTenantSlugFromRequest(req)
    // This endpoint is used by client pages to *poll status*.
    // During hydration/localStorage bootstrapping, applicantId can be missing briefly.
    // Return an empty status instead of throwing/4xx so the UI doesn’t trip an error overlay.
    if (!applicantId) return NextResponse.json({ documents: null })

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      // This endpoint is called by client onboarding pages just to read status.
      // In local/dev it’s common to not have a service role configured yet;
      // degrade gracefully so the UI can still render.
      return NextResponse.json({ documents: null })
    }

    const supabase = createClient(url, key)

    const documents = await getOrSetCache(
      buildCacheKey("worker_documents", ["user", applicantId, tenantSlug ?? ""], { status: true }),
      async () => {
        const ctx = await resolveOnboardingWorker(supabase, applicantId, tenantSlug)
        if (ctx?.workerId) {
          const { data, error } = await supabase
            .from("worker_documents")
            .select("*")
            .eq("worker_id", ctx.workerId)
            .limit(1)

          if (error) {
            if (isMissingRelationError(error)) return null
            throw error
          }
          return data?.[0] ?? null
        }

        const { data: worker, error: wErr } = await supabase
          .from("worker")
          .select("id")
          .eq("user_id", applicantId)
          .maybeSingle()

        if (wErr) {
          if (isMissingRelationError(wErr)) return null
          throw wErr
        }
        if (!worker?.id) return null

        const { data, error } = await supabase
          .from("worker_documents")
          .select("*")
          .eq("worker_id", worker.id)
          .limit(1)

        if (error) {
          if (isMissingRelationError(error)) return null
          throw error
        }
        return data?.[0] ?? null
      },
      CACHE_TTL_SECONDS.dashboards
    )
    return NextResponse.json({ documents })
  } catch (err: unknown) {
    console.error("[onboarding/worker-documents] GET", err)
    // This is a polling endpoint used by client pages; never hard-fail the UI.
    // Return empty status even on unexpected errors.
    return NextResponse.json({ documents: null })
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
    console.info("[debug-doc-upload] worker-documents:start", {
      route: "/api/onboarding/worker-documents",
      applicantId,
      workerId: worker.id,
      payload: {
        nursing_license_url: body.nursing_license_url ?? null,
        tb_test_url: body.tb_test_url ?? null,
        cpr_certification_url: body.cpr_certification_url ?? null,
        ssn_url: body.ssn_url ?? null,
        drivers_license_url: body.drivers_license_url ?? null,
      },
    })

    const { data: existingRows, error: selErr } = await supabase
      .from("worker_documents")
      // Use "*" so this endpoint works even if newer columns
      // (e.g. ssn_back_url) haven't been migrated yet.
      .select("*")
      .eq("worker_id", worker.id)
      .limit(1)

    if (selErr) throw selErr

    const existing = existingRows?.[0] as Record<string, unknown> | undefined
    const ex = (existing || {}) as Record<string, string | null | undefined>

    const merged: Record<string, unknown> = {
      tenant_id: workerTenantId,
      worker_id: worker.id,
      updated_at: new Date().toISOString(),
    }

    for (const k of URL_KEYS) {
      if (body[k] !== undefined) {
        const v = body[k]
        merged[k] = v && String(v).trim() ? String(v).trim() : null
      } else {
        // Only carry forward existing columns; don't send unknown keys
        // to older schemas (would trigger "column does not exist").
        if (Object.prototype.hasOwnProperty.call(ex, k)) {
          merged[k] = ex[k] ?? null
        }
      }
    }

    const existingId =
      existing?.id != null && existing.id !== "" ? String(existing.id) : undefined

    if (existingId) {
      const { worker_id: _w, ...updatePayload } = merged
      const { error: upErr } = await supabase.from("worker_documents").update(updatePayload).eq("id", existingId)
      if (upErr) {
        console.error("[onboarding/worker-documents] update", upErr)
        const msg = [upErr.message, upErr.details, upErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
      console.info("[debug-doc-upload] worker-documents:update:success", {
        route: "/api/onboarding/worker-documents",
        applicantId,
        workerId: worker.id,
        rowId: existingId,
        updatePayload,
      })
    } else {
      const { error: insErr } = await supabase.from("worker_documents").insert(merged)
      if (insErr) {
        console.error("[onboarding/worker-documents] insert", insErr)
        const msg = [insErr.message, insErr.details, insErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
      console.info("[debug-doc-upload] worker-documents:insert:success", {
        route: "/api/onboarding/worker-documents",
        applicantId,
        workerId: worker.id,
        insertPayload: merged,
      })
    }

    await Promise.all([
      invalidateResourceCache("worker_documents", String(worker.id)),
      invalidateTenantCache("worker_documents", workerTenantId),
      invalidateUserCache("worker_documents", applicantId),
      invalidateResourceCache("worker", String(worker.id)),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("[onboarding/worker-documents]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
