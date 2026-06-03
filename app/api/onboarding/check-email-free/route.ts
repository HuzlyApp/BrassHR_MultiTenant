import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { resolveOnboardingTenantId } from "@/lib/tenant/resolve-onboarding-tenant-id"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

/**
 * Returns 409 if email is already on a different worker (user_id) than this applicant.
 * Used when save-worker falls back to the browser Supabase client (no service role).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    const emailRaw = typeof body.email === "string" ? body.email.trim() : ""
    const limited = await enforceRateLimit(req, {
      namespace: "onboarding-check-email",
      key: `${getClientIp(req)}:${emailRaw.toLowerCase() || "missing"}`,
      limit: Number(process.env.RATE_LIMIT_EMAIL_CHECK_PER_HOUR ?? 30),
      windowMs: 60 * 60 * 1000,
      failClosed: false,
    })
    if (limited) return limited

    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const emailNorm = emailRaw.toLowerCase()
    if (!emailNorm) {
      return NextResponse.json({ ok: true })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json(
        { error: "Server is not configured to validate email uniqueness" },
        { status: 503 },
      )
    }

    const supabase = createClient(url, key)
    const tenantSlug =
      typeof body.tenantSlug === "string" ? body.tenantSlug.trim().toLowerCase() : ""
    const tenantRes = await resolveOnboardingTenantId(supabase, tenantSlug || null)
    if (!tenantRes.ok) {
      return NextResponse.json({ error: tenantRes.error }, { status: 503 })
    }
    const { data: dupRows, error: dupErr } = await supabase
      .from("worker")
      .select("id")
      .eq("tenant_id", tenantRes.tenantId)
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

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("[onboarding/check-email-free]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
