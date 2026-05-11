import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

function isMissingColumnErr(e: unknown) {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  if (err.code === "42703") return true // undefined_column
  return typeof err.message === "string" && err.message.includes(" does not exist")
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

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id")
      .eq("user_id", applicantId)
      .maybeSingle()

    if (wErr) throw wErr
    const workerId = worker?.id ? String(worker.id) : null

    // Support both schemas:
    // - new: skill_assessments.user_id
    // - existing migration: skill_assessments.worker_id
    let completedCount = 0

    const tryCount = async (col: "user_id" | "worker_id", value: string) => {
      const { count, error } = await supabase
        .from("skill_assessments")
        .select("id", { count: "exact", head: true })
        .eq("completed", true)
        .eq(col, value)
      return { count: count ?? 0, error }
    }

    // Prefer worker_id if we have a worker row (most consistent with other onboarding tables).
    if (workerId) {
      const a = await tryCount("worker_id", workerId)
      if (!a.error) {
        completedCount = a.count
      } else if (isMissingColumnErr(a.error)) {
        const b = await tryCount("user_id", applicantId)
        if (b.error) throw b.error
        completedCount = b.count
      } else {
        throw a.error
      }
    } else {
      const b = await tryCount("user_id", applicantId)
      if (!b.error) {
        completedCount = b.count
      } else if (isMissingColumnErr(b.error)) {
        // last resort: maybe the column is worker_id but worker row doesn't exist yet
        completedCount = 0
      } else {
        throw b.error
      }
    }

    return NextResponse.json({ completedCount })
  } catch (err: unknown) {
    console.error("[onboarding/skill-assessments-progress]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

