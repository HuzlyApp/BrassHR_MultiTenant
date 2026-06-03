import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { validateStep1Form } from "@/lib/onboardingStep1Validation"
import { resolveOnboardingTenantId } from "@/lib/tenant/resolve-onboarding-tenant-id"
import { ensureWorkerOnboardingProgress } from "@/lib/onboarding/ensure-worker-progress"
import { invalidateResourceCache, invalidateTableCache, invalidateTenantCache, invalidateUserCache } from "@/lib/cache"

export const runtime = "nodejs"

function isMissingColumnErr(e: unknown) {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  // Postgres undefined_column
  if (err.code === "42703") return true
  return typeof err.message === "string" && err.message.includes(" does not exist")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) {
      return NextResponse.json(
        {
          error: "MISSING_SUPABASE_URL",
          hint: "Set NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL in .env.local",
        },
        { status: 503 }
      )
    }
    if (!key) {
      // Client may fall back to anon Supabase client if RLS allows inserts on `worker`.
      return NextResponse.json(
        {
          error: "MISSING_SERVICE_ROLE_KEY",
          hint: "Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API → service_role). This is a secret key, not a job title or the worker table.",
        },
        { status: 503 }
      )
    }

    const supabase = createClient(url, key)

    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : ""
    const tenantRes = await resolveOnboardingTenantId(supabase, tenantSlug || null)
    if (!tenantRes.ok) {
      return NextResponse.json(
        { error: tenantRes.error, code: "MISSING_TENANT" },
        { status: 503 },
      )
    }
    const tenantId = tenantRes.tenantId

    // `user_id` is the stable onboarding key (matches localStorage applicantId, must be a UUID).
    const emailRaw = String(body.email ?? "").trim()
    const emailNorm = emailRaw.toLowerCase()
    const step1Fields = {
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      address1: String(body.address1 ?? ""),
      address2: String(body.address2 ?? ""),
      city: String(body.city ?? ""),
      state: String(body.state ?? ""),
      zipCode: String(body.zipCode ?? ""),
      phone: String(body.phone ?? ""),
      email: String(body.email ?? ""),
      jobRole: String(body.jobRole ?? ""),
    }
    const step1Err = validateStep1Form(step1Fields)
    if (step1Err) {
      return NextResponse.json(
        { error: step1Err.message, code: "VALIDATION_ERROR", field: step1Err.code },
        { status: 400 },
      )
    }

    const addressLat = Number(body.addressLat)
    const addressLng = Number(body.addressLng)
    const hasGeo =
      Number.isFinite(addressLat) &&
      Number.isFinite(addressLng) &&
      typeof body.addressNormalized === "string" &&
      body.addressNormalized.trim().length > 0

    const baseRow: Record<string, unknown> = {
      tenant_id: tenantId,
      user_id: applicantId,
      first_name: step1Fields.firstName.trim(),
      last_name: step1Fields.lastName.trim(),
      address1: step1Fields.address1.trim(),
      address2: step1Fields.address2.trim(),
      city: step1Fields.city.trim(),
      state: step1Fields.state.trim(),
      zip: step1Fields.zipCode.trim(),
      phone: step1Fields.phone.trim(),
      email: emailNorm,
      job_role: step1Fields.jobRole.trim(),
      updated_at: new Date().toISOString(),
    }

    if (hasGeo) {
      baseRow.lat = addressLat
      baseRow.lng = addressLng
    }

    if (emailNorm) {
      const { data: dupRows, error: dupErr } = await supabase
        .from("worker")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", emailNorm)
        .neq("user_id", applicantId)
        .limit(1)

      if (dupErr) throw dupErr
      if (dupRows && dupRows.length > 0) {
        return NextResponse.json(
          {
            error: "This email is already used by another application. Sign in or use a different email.",
            code: "DUPLICATE_EMAIL",
          },
          { status: 409 },
        )
      }
    }

    // Some DBs use `status` while others use `worker_status` (enum, constrained by worker_status_chk).
    // We'll try status first, then worker_status, then omit entirely if neither column exists.
    const rawStatus = String(body.status ?? "").trim()
    const rowAttempts: Record<string, unknown>[] = [
      rawStatus ? { ...baseRow, status: rawStatus } : { ...baseRow },
      rawStatus ? { ...baseRow, worker_status: rawStatus } : { ...baseRow },
      { ...baseRow },
    ]

    // Avoid upsert(..., onConflict: "user_id") — it requires a UNIQUE constraint/index on worker.user_id.
    // Some DBs may not have run the migration yet; update-by-id / insert works everywhere.
    const { data: existingRows, error: selErr } = await supabase
      .from("worker")
      .select("id")
      .eq("user_id", applicantId)
      .limit(1)

    if (selErr) throw selErr
    const existingId = existingRows?.[0]?.id != null ? String(existingRows[0].id) : null

    if (existingId) {
      let lastErr: unknown = null
      for (const attempt of rowAttempts) {
        const { user_id: _u, ...updatePayload } = attempt as Record<string, unknown>
        const { error: upErr } = await supabase.from("worker").update(updatePayload).eq("id", existingId)
        if (!upErr) {
          lastErr = null
          break
        }
        lastErr = upErr
        if (!isMissingColumnErr(upErr)) break
      }
      if (lastErr) {
        const upErr = lastErr as { message?: string; details?: string; hint?: string; code?: string }
        console.error("[onboarding/save-worker] update", upErr)
        if (upErr.code === "23505" && /email|worker/i.test(String(upErr.message))) {
          return NextResponse.json(
            {
              error: "This email is already used by another application. Sign in or use a different email.",
              code: "DUPLICATE_EMAIL",
            },
            { status: 409 },
          )
        }
        const msg = [upErr.message, upErr.details, upErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    } else {
      let lastErr: unknown = null
      for (const attempt of rowAttempts) {
        const { error: insErr } = await supabase.from("worker").insert(attempt)
        if (!insErr) {
          lastErr = null
          break
        }
        lastErr = insErr
        if (!isMissingColumnErr(insErr)) break
      }
      if (lastErr) {
        const insErr = lastErr as { message?: string; details?: string; hint?: string; code?: string }
        console.error("[onboarding/save-worker] insert", insErr)
        if (insErr.code === "23505" && /email|worker/i.test(String(insErr.message))) {
          return NextResponse.json(
            {
              error: "This email is already used by another application. Sign in or use a different email.",
              code: "DUPLICATE_EMAIL",
            },
            { status: 409 },
          )
        }
        const msg = [insErr.message, insErr.details, insErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    }

    const { data: workerAfter } = await supabase
      .from("worker")
      .select("id")
      .eq("user_id", applicantId)
      .maybeSingle()

    if (workerAfter?.id) {
      try {
        await ensureWorkerOnboardingProgress(supabase, String(workerAfter.id), tenantId)
      } catch (e) {
        console.error("[onboarding/save-worker] progress init", e)
      }
      await invalidateResourceCache("worker", String(workerAfter.id))
    }

    await Promise.all([
      invalidateTenantCache("worker_search", tenantId),
      invalidateTenantCache("worker", tenantId),
      invalidateUserCache("worker", applicantId),
      invalidateTableCache("worker_search"),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("[onboarding/save-worker]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
