import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { resolveWorkerByApplicantId } from "@/lib/onboarding/resolve-worker-context"

export async function GET(req: NextRequest) {
  const resumeId = req.nextUrl.searchParams.get("resumeId")?.trim() ?? ""
  const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() ?? ""

  if (!resumeId) {
    return NextResponse.json({ error: "resumeId is required" }, { status: 400 })
  }

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key)

  const { data: resume, error } = await supabase
    .from("worker_resumes")
    .select(
      "id, worker_id, parsing_status, parse_status, parsed_json, parse_error, parse_started_at, parse_completed_at, extraction_ms, ai_parse_ms, text_length",
    )
    .eq("id", resumeId)
    .maybeSingle()

  if (error) {
    console.error("[resume-parse-status]", error)
    return NextResponse.json({ error: "Could not load resume parse status" }, { status: 500 })
  }

  if (!resume?.id) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 })
  }

  if (applicantId) {
    const ctx = await resolveWorkerByApplicantId(supabase, applicantId)
    if (!ctx || String(resume.worker_id) !== ctx.workerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  return NextResponse.json({
    resumeId: resume.id,
    parseStatus: resume.parse_status ?? resume.parsing_status ?? "pending",
    parsedJson: resume.parsed_json ?? null,
    parseError: resume.parse_error ?? null,
    parseStartedAt: resume.parse_started_at ?? null,
    parseCompletedAt: resume.parse_completed_at ?? null,
    extractionMs: resume.extraction_ms ?? null,
    aiParseMs: resume.ai_parse_ms ?? null,
    textLength: resume.text_length ?? null,
  })
}
