"use client"

import type { MutableRefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { upsertSkillAnswerRow, syncSkillAssessmentJson } from "@/lib/skill-assessment-answer-rows"

const DEBOUNCE_MS = 550
const QUEUE_KEY = "pending_skill_answer_upserts_v1"

type QueueItem = {
  categoryId: string
  categorySlug: string
  skillId: string
  answerValue: number
}

function readQueue(): QueueItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const p = JSON.parse(raw) as unknown
    return Array.isArray(p) ? (p as QueueItem[]) : []
  } catch {
    return []
  }
}

function writeQueue(items: QueueItem[]) {
  if (typeof window === "undefined") return
  try {
    if (items.length === 0) localStorage.removeItem(QUEUE_KEY)
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

export function useQuizAutosave(
  supabase: SupabaseClient,
  opts: {
    categorySlug: string
    answersRef: MutableRefObject<Record<string, number>>
  }
) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<{
    skillId: string
    value: number
    categoryId: string
  } | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const flush = useCallback(async () => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const { categorySlug, answersRef } = optsRef.current

    const res = await upsertSkillAnswerRow(supabase, {
      categoryId: p.categoryId,
      skillId: p.skillId,
      answerValue: p.value,
    })

    if (!res.ok && res.error === "no_worker_row") {
      const q = readQueue()
      q.push({
        categoryId: p.categoryId,
        categorySlug,
        skillId: p.skillId,
        answerValue: p.value,
      })
      writeQueue(q)
      setSaveState("offline")
      return
    }

    await syncSkillAssessmentJson(supabase, categorySlug, answersRef.current, false)

    if (res.ok) {
      setSaveState("saved")
      window.setTimeout(() => setSaveState("idle"), 1600)
    } else {
      setSaveState("idle")
    }
  }, [supabase])

  const flushRef = useRef(flush)
  flushRef.current = flush

  const scheduleSave = useCallback((skillId: string, value: number, categoryId: string) => {
    pendingRef.current = { skillId, value, categoryId }
    setSaveState("saving")
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void flushRef.current()
    }, DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    const onOnline = () => {
      const q = readQueue()
      if (q.length === 0) return
      void (async () => {
        const { categorySlug, answersRef } = optsRef.current
        const remain: QueueItem[] = []
        for (const item of q) {
          const r = await upsertSkillAnswerRow(supabase, {
            categoryId: item.categoryId,
            skillId: item.skillId,
            answerValue: item.answerValue,
          })
          if (!r.ok) remain.push(item)
        }
        writeQueue(remain)
        if (remain.length === 0) {
          await syncSkillAssessmentJson(supabase, categorySlug, answersRef.current, false)
          setSaveState("saved")
          window.setTimeout(() => setSaveState("idle"), 1600)
        }
      })()
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [supabase])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      void flushRef.current()
    }
  }, [])

  return { scheduleSave, saveState, flushPending: flush }
}
