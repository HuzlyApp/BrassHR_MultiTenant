"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  normalizeParsedResume,
  normalizedResumeToStoredJson,
} from "@/lib/resumeParseQuality"

export type ResumeParsePollStatus = "idle" | "processing" | "completed" | "failed" | "pending"

export type ResumeParsePollState = {
  status: ResumeParsePollStatus
  parsedResume: Record<string, string> | null
  parseError: string | null
  isPolling: boolean
}

const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 90

function persistParsedResume(raw: Record<string, unknown>): void {
  const normalized = normalizeParsedResume(raw)
  localStorage.setItem("parsedResume", JSON.stringify(normalizedResumeToStoredJson(normalized)))
}

/**
 * Poll GET /api/resume-parse-status until Grok parsing finishes.
 * Autofills localStorage parsedResume when completed.
 */
export function useResumeParsePoll(resumeId: string | null): ResumeParsePollState {
  const [status, setStatus] = useState<ResumeParsePollStatus>("idle")
  const [parsedResume, setParsedResume] = useState<Record<string, string> | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const attemptsRef = useRef(0)

  const applyResult = useCallback(
    (data: {
      parseStatus?: string
      parsedJson?: Record<string, unknown> | null
      parseError?: string | null
    }) => {
      const ps = String(data.parseStatus ?? "pending") as ResumeParsePollStatus
      setStatus(ps)

      if (ps === "completed" && data.parsedJson && typeof data.parsedJson === "object") {
        persistParsedResume(data.parsedJson)
        setParsedResume(normalizedResumeToStoredJson(normalizeParsedResume(data.parsedJson)))
        setParseError(null)
        return true
      }

      if (ps === "failed") {
        setParseError(data.parseError ?? "Resume parsing failed")
        if (data.parsedJson && typeof data.parsedJson === "object") {
          persistParsedResume(data.parsedJson)
          setParsedResume(normalizedResumeToStoredJson(normalizeParsedResume(data.parsedJson)))
        }
        return true
      }

      return ps !== "processing" && ps !== "pending"
    },
    [],
  )

  useEffect(() => {
    if (!resumeId || typeof window === "undefined") {
      setStatus("idle")
      setIsPolling(false)
      return
    }

    attemptsRef.current = 0
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      if (cancelled) return
      const applicantId = localStorage.getItem("applicantId")?.trim() || ""
      const qs = new URLSearchParams({ resumeId })
      if (applicantId) qs.set("applicantId", applicantId)

      setIsPolling(true)
      try {
        const res = await fetch(`/api/resume-parse-status?${qs.toString()}`)
        if (!res.ok) {
          attemptsRef.current += 1
          if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
            setStatus("failed")
            setParseError("Could not check resume parsing status.")
            setIsPolling(false)
          } else {
            timer = setTimeout(poll, POLL_INTERVAL_MS)
          }
          return
        }

        const data = (await res.json()) as {
          parseStatus?: string
          parsedJson?: Record<string, unknown> | null
          parseError?: string | null
        }

        const done = applyResult(data)
        if (done || cancelled) {
          setIsPolling(false)
          return
        }

        attemptsRef.current += 1
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setStatus("processing")
          setIsPolling(false)
          return
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS)
      } catch {
        attemptsRef.current += 1
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setStatus("failed")
          setParseError("Could not check resume parsing status.")
          setIsPolling(false)
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [resumeId, applyResult])

  return { status, parsedResume, parseError, isPolling }
}
