import type { SupabaseClient } from "@supabase/supabase-js"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import { grokParseResume } from "@/lib/resume/grok-parse-resume"
import { createTimer, logResumeTiming } from "@/lib/resume/timing"
import { sendResumeContinuationEmail } from "@/lib/onboarding/send-resume-continuation-email"
import {
  claimParseJob,
  completeParseResult,
} from "@/lib/resume/resume-parsing-persistence"

export type ResumeParseJobResult = {
  parsingStatus: "completed" | "failed"
  parsedJson: Record<string, string> | null
  parseError: string | null
  aiParseMs: number
  qualityPassed: boolean
}

export type ResumeParseContinuationEmailParams = {
  workerId: string
  tenantId: string
  resumeId: string
  origin: string
  tenantSlug?: string | null
  request?: Request
}

export async function runResumeParseJob(params: {
  supabase: SupabaseClient
  resumeId: string
  text: string
  tenantId?: string
  workerId?: string
  applicantId?: string
  fileHash?: string
  forceReprocess?: boolean
  continuationEmail?: ResumeParseContinuationEmailParams
}): Promise<ResumeParseJobResult> {
  const { supabase, resumeId, text } = params
  const jobTimer = createTimer()
  const now = new Date().toISOString()

  let parseResultId: string | null = null
  if (params.tenantId && params.fileHash && params.workerId && params.applicantId) {
    const claim = await claimParseJob(supabase, {
      tenantId: params.tenantId,
      workerId: params.workerId,
      applicantId: params.applicantId,
      resumeFileId: resumeId,
      fileHash: params.fileHash,
      forceReprocess: params.forceReprocess,
      request: params.continuationEmail?.request,
    });

    if (claim.kind === "reuse" && claim.result.parsedJson) {
      const completedAt = new Date().toISOString()
      await supabase
        .from("worker_resumes")
        .update({
          parsing_status: "completed",
          parse_status: "completed",
          parsed_json: claim.result.parsedJson,
          parse_error: null,
          parse_completed_at: completedAt,
          parsed_at: completedAt,
        })
        .eq("id", resumeId)

      return {
        parsingStatus: "completed",
        parsedJson: claim.result.parsedJson,
        parseError: null,
        aiParseMs: 0,
        qualityPassed: true,
      }
    }

    if (claim.kind === "wait") {
      return {
        parsingStatus: "failed",
        parsedJson: null,
        parseError: "Resume parsing is already in progress",
        aiParseMs: 0,
        qualityPassed: false,
      }
    }

    if (claim.kind === "run") {
      parseResultId = claim.parseResultId
    }
  }

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

      if (parseResultId && params.tenantId) {
        await completeParseResult(supabase, {
          parseResultId,
          tenantId: params.tenantId,
          parsedJson,
          parsingStatus: "completed",
          durationMs: jobTimer.elapsedMs(),
          request: params.continuationEmail?.request,
        })
      }

      logResumeTiming("resume-parse-job", "completed", {
        resumeId,
        totalMs: jobTimer.elapsedMs(),
        aiParseMs,
        qualityPassed: true,
      })

      if (params.continuationEmail) {
        await sendResumeContinuationEmail(params.supabase, {
          workerId: params.continuationEmail.workerId,
          tenantId: params.continuationEmail.tenantId,
          resumeId: params.continuationEmail.resumeId,
          origin: params.continuationEmail.origin,
          tenantSlug: params.continuationEmail.tenantSlug ?? null,
          extractedText: text,
          parsedResume: parsedJson,
          trigger: "resume_parse",
          request: params.continuationEmail.request,
        })
      }

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

    if (parseResultId && params.tenantId) {
      await completeParseResult(supabase, {
        parseResultId,
        tenantId: params.tenantId,
        parsedJson,
        parsingStatus: "failed",
        errorCode: "quality_gate",
        errorMessage: parseError,
        durationMs: jobTimer.elapsedMs(),
        request: params.continuationEmail?.request,
      })
    }

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

    if (parseResultId && params.tenantId) {
      await completeParseResult(supabase, {
        parseResultId,
        tenantId: params.tenantId,
        parsedJson: null,
        parsingStatus: "failed",
        errorCode: "provider_error",
        errorMessage: parseError,
        durationMs: jobTimer.elapsedMs(),
        request: params.continuationEmail?.request,
      })
    }

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
