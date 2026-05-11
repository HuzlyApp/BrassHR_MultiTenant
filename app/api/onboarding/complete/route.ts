import { NextRequest, NextResponse } from "next/server"
import { createClient as createSbAdmin } from "@supabase/supabase-js"
import { requireNexusSessionUser } from "@/lib/auth/api-session"
import { getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

type Body = { applicantId: string }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const applicantId = typeof body?.applicantId === "string" ? body.applicantId.trim() : ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    // Verify the caller is the same authenticated Nexus user (prevents arbitrary role escalation).
    const sessionUser = await requireNexusSessionUser()
    if (sessionUser instanceof NextResponse) return sessionUser
    if (sessionUser.id !== applicantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = getSupabaseUrl()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const admin = createSbAdmin(url, serviceKey, { auth: { persistSession: false } })

    const { data, error } = await admin.auth.admin.updateUserById(applicantId, {
      app_metadata: { role: "super_admin", platform: "nexus" },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: data.user })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

