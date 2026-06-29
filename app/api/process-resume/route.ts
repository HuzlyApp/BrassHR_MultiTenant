import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"
import {
  evaluateResumeParseQuality,
  normalizeParsedResume,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import { grokParseResume } from "@/lib/resume/grok-parse-resume"
import { runResumeParseJob } from "@/lib/resume/run-resume-parse-job"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"
import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit"

type ProcessResumeBody = {
  text?: string
  resumeId?: string
}

export async function POST(req: Request) {
  const routeTimer = createTimer()

  const limited = await enforceRateLimit(req, {
    namespace: "process-resume",
    key: getClientIp(req),
    limit: Number(process.env.RATE_LIMIT_AI_PER_HOUR ?? 20),
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  })
  if (limited) return limited

  const body = (await req.json()) as ProcessResumeBody
  const resumeId = typeof body.resumeId === "string" ? body.resumeId.trim() : ""

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = url && key ? createClient(url, key) : null

  if (resumeId && supabase) {
    const { data: row } = await supabase
      .from("worker_resumes")
      .select("parsed_data")
      .eq("id", resumeId)
      .maybeSingle()

    const storedText =
      row?.parsed_data &&
      typeof row.parsed_data === "object" &&
      !Array.isArray(row.parsed_data) &&
      typeof (row.parsed_data as Record<string, unknown>).text === "string"
        ? String((row.parsed_data as Record<string, unknown>).text)
        : ""

    const text = (body.text?.trim() || storedText).trim()
    if (!text) {
      return NextResponse.json({ error: "Resume text not found" }, { status: 400 })
    }

    const result = await runResumeParseJob({ supabase, resumeId, text })

    logResumeTiming("process-resume", "resume-id-complete", {
      totalMs: routeTimer.elapsedMs(),
      resumeId,
      parsingStatus: result.parsingStatus,
      aiParseMs: result.aiParseMs,
    })

    const normalized = result.parsedJson
      ? normalizeParsedResume(result.parsedJson)
      : null

    return NextResponse.json({
      parseStatus: result.parsingStatus,
      parsedJson: result.parsedJson,
      parseError: result.parseError,
      qualityPassed: result.qualityPassed,
      ...(normalized ? normalizedResumeToStoredJson(normalized) : {}),
    })
  }

  const text = body.text?.trim()
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  try {
    const grok = await grokParseResume(text)
    const qualityTimer = createTimer()
    const quality = evaluateResumeParseQuality(grok.normalized)
    const qualityMs = qualityTimer.elapsedMs()

    logResumeTiming("process-resume", "complete", {
      totalMs: routeTimer.elapsedMs(),
      aiParseMs: grok.aiParseMs,
      qualityMs,
      textLength: text.length,
      grokSnippetLength: grok.grokSnippet.length,
      grokSnippetReduced: grok.grokSnippetReduced,
      qualityPassed: quality.ok,
    })

    const stored = normalizedResumeToStoredJson(grok.normalized)

    if (!quality.ok) {
      return NextResponse.json({
        parseStatus: "failed",
        parsedJson: stored,
        parseError: quality.message ?? RESUME_PARSE_FAILED_USER_MESSAGE,
        missingFields: quality.missingFieldLabels,
        qualityPassed: false,
        ...stored,
      })
    }

    return NextResponse.json({
      parseStatus: "completed",
      parsedJson: stored,
      qualityPassed: true,
      ...stored,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to parse resume"
    logResumeTiming("process-resume", "error", {
      totalMs: routeTimer.elapsedMs(),
      parseError: msg,
    })
    return NextResponse.json(
      { parseStatus: "failed", parseError: msg, qualityPassed: false },
      { status: 500 },
    )
  }
}
