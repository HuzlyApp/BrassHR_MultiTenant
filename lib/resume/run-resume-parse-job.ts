import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import { grokParseResume } from "@/lib/resume/grok-parse-resume"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"

export type ResumeParseJobResult = {
  parsingStatus: "completed" | "failed"
  parsedJson: Record<string, string> | null
  parseError: string | null
  aiParseMs: number
  qualityPassed: boolean
}

export async function runResumeParseJob(params: {
  supabase: SupabaseClient
  resumeId: string
  text: string
}): Promise<ResumeParseJobResult> {
  const { supabase, resumeId, text } = params
  const jobTimer = createTimer()
  const now = new Date().toISOString()

  await supabase
    .from("worker_resumes")
    .update({
      parsing_status: "processing",
      parse_status: "processing",
      parse_started_at: now,
      parse_error: null,
    })
    .eq("id", resumeId)

  logResumeTiming("resume-parse-job", "started", {
    resumeId,
    textLength: text.length,
  })

  let aiParseMs = 0
  try {
    const grok = await grokParseResume(text)
    aiParseMs = grok.aiParseMs

    const qualityTimer = createTimer()
    const quality = evaluateResumeParseQuality(grok.normalized)
    const qualityMs = qualityTimer.elapsedMs()

    logResumeTiming("resume-parse-job", "quality-gate", {
      resumeId,
      qualityMs,
      qualityPassed: quality.ok,
    })

    const parsedJson = normalizedResumeToStoredJson(
      quality.ok ? quality.normalized : grok.normalized,
    )
    const completedAt = new Date().toISOString()

    if (quality.ok) {
      await supabase
        .from("worker_resumes")
        .update({
          parsing_status: "completed",
          parse_status: "completed",
          parsed_json: parsedJson,
          parsed_data: { text, pre_extracted: grok.preExtracted },
          extracted_text: text,
          parse_error: null,
          parse_completed_at: completedAt,
          parsed_at: completedAt,
          ai_parse_ms: aiParseMs,
        })
        .eq("id", resumeId)

      logResumeTiming("resume-parse-job", "completed", {
        resumeId,
        totalMs: jobTimer.elapsedMs(),
        aiParseMs,
        qualityPassed: true,
      })

      return {
        parsingStatus: "completed",
        parsedJson,
        parseError: null,
        aiParseMs,
        qualityPassed: true,
      }
    }

    const parseError = quality.message ?? RESUME_PARSE_FAILED_USER_MESSAGE
    await supabase
      .from("worker_resumes")
      .update({
        parsing_status: "failed",
        parse_status: "failed",
        parsed_json: parsedJson,
        parsed_data: { text, pre_extracted: grok.preExtracted },
        extracted_text: text,
        parse_error: parseError,
        parse_completed_at: completedAt,
        parsed_at: null,
        ai_parse_ms: aiParseMs,
      })
      .eq("id", resumeId)

    logResumeTiming("resume-parse-job", "quality-failed-non-blocking", {
      resumeId,
      totalMs: jobTimer.elapsedMs(),
      aiParseMs,
      parseError,
    })

    return {
      parsingStatus: "failed",
      parsedJson,
      parseError,
      aiParseMs,
      qualityPassed: false,
    }
  } catch (e: unknown) {
    const parseError = e instanceof Error ? e.message : "Resume parsing failed"
    const completedAt = new Date().toISOString()

    await supabase
      .from("worker_resumes")
      .update({
        parsing_status: "failed",
        parse_status: "failed",
        parse_error: parseError,
        parse_completed_at: completedAt,
        ai_parse_ms: aiParseMs || null,
      })
      .eq("id", resumeId)

    logResumeTiming("resume-parse-job", "error", {
      resumeId,
      totalMs: jobTimer.elapsedMs(),
      parseError,
    })

    return {
      parsingStatus: "failed",
      parsedJson: null,
      parseError,
      aiParseMs,
      qualityPassed: false,
    }
  }
}
