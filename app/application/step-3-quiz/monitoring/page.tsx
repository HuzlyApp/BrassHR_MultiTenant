"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { MONITORING_CATEGORY_ID } from "@/lib/monitoring-category"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingLoader from "@/app/components/OnboardingLoader"
import { ChevronRight } from "lucide-react"
import { getWorkerSessionContext } from "@/lib/onboarding-worker-pk"
import { fetchApplicantSkillAnswers } from "@/lib/skill-assessment-answer-rows"
import { useQuizAutosave } from "@/lib/useQuizAutosave"
import AutosaveStatus from "@/app/components/AutosaveStatus"

/** `skill_assessments.worker_id` = auth user id; `category` matches `skill_categories.slug` */
const CATEGORY_SLUG = "monitoring"
const PAGE_SIZE = 5

type QuestionRow = {
  id: string
  question: string
  description?: string | null
  quiz_number: number | null
}

type CategoryRow = {
  id: string
  title: string
  description: string | null
}

function normalizeAnswers(
  raw: unknown,
  questions: QuestionRow[]
): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, number> = {}
  const keys = Object.keys(o)
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const allUuidKeys = keys.length > 0 && keys.every((k) => uuidLike.test(k))
  if (allUuidKeys) {
    for (const k of keys) {
      const v = o[k]
      if (typeof v === "number" && v >= 1 && v <= 4) out[k] = v
    }
    return out
  }
  const allNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k))
  if (allNumericKeys && questions.length) {
    for (const k of keys) {
      const idx = Number(k)
      const v = o[k]
      const q = questions[idx]
      if (q && typeof v === "number" && v >= 1 && v <= 4) out[q.id] = v
    }
    return out
  }
  return out
}

export default function MonitoringQuiz() {
  const router = useRouter()
  const [category, setCategory] = useState<CategoryRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const answersRef = useRef<Record<string, number>>({})
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const { scheduleSave, saveState, flushPending } = useQuizAutosave(supabase, {
    categorySlug: CATEGORY_SLUG,
    answersRef,
  })

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(questions.length / PAGE_SIZE) || 1),
    [questions.length]
  )

  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, questions.length)
  const pageQuestions = questions.slice(start, end)

  const loadQuiz = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const { data: cat, error: cErr } = await supabase
        .from("skill_categories")
        .select("id, title, description")
        .eq("id", MONITORING_CATEGORY_ID)
        .maybeSingle()

      if (cErr) throw cErr
      if (!cat) {
        setCategory(null)
        setQuestions([])
        setLoading(false)
        return
      }

      setCategory(cat as CategoryRow)

      const { data: qs, error: qErr } = await supabase
        .from("skill_questions")
        .select("id, question, quiz_number")
        .eq("category_id", cat.id)
        .order("quiz_number", { ascending: true, nullsFirst: false })

      if (qErr) throw qErr
      const ordered = (qs ?? []) as QuestionRow[]
      setQuestions(ordered)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      const applicantFromLs =
        typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
      const uid = user?.id ?? applicantFromLs
      if (!uid) {
        setLoading(false)
        return
      }

      const { data: worker } = await supabase
        .from("worker")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle()
      const workerId = worker?.id ? String(worker.id) : uid

      const { data: row } = await supabase
        .from("skill_assessments")
        .select("answers")
        .eq("worker_id", workerId)
        .eq("category", CATEGORY_SLUG)
        .maybeSingle()

      const legacy = normalizeAnswers(row?.answers ?? null, ordered)
      const merged = await fetchApplicantSkillAnswers(supabase, cat.id, legacy)
      setAnswers(merged)
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "Failed to load quiz"
      setLoadError(msg)
      console.error("[monitoring quiz]", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuiz()
  }, [loadQuiz])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const selectAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value }
      answersRef.current = next
      return next
    })
    if (category?.id) scheduleSave(questionId, value, category.id)
  }

  const splitQuestionDetail = (question: string, description?: string | null) => {
    if (description) {
      const clean = description.trim()
      const withBrackets =
        clean.startsWith("(") && clean.endsWith(")")
          ? clean
          : `(${clean.replace(/^\(+|\)+$/g, "")})`
      return { title: question, detail: withBrackets }
    }

    const match = question.match(/^(.*?)(\s*\(.*\))$/)
    if (!match) {
      return { title: question, detail: null as string | null }
    }

    return {
      title: match[1].trim(),
      detail: match[2].trim(),
    }
  }

  function quizFullyComplete() {
    return questions.length > 0 && questions.every((q) => answers[q.id] != null)
  }

  async function persist(completed: boolean) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const applicantFromLs =
      typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
    const uid = userData?.user?.id ?? applicantFromLs
    if (userError || !uid) {
      if (completed) localStorage.setItem("monitoring_done", "true")
      return true
    }
    const ctx = await getWorkerSessionContext(supabase)
    if (!ctx) {
      alert("Could not load worker profile.")
      return false
    }
    const workerId = ctx.id
    const cleanAnswers = JSON.parse(JSON.stringify(answers)) as Record<string, number>

    const { data: existing, error: findErr } = await supabase
      .from("skill_assessments")
      .select("id")
      .eq("worker_id", workerId)
      .eq("category", CATEGORY_SLUG)
      .maybeSingle()

    if (findErr) {
      console.error(findErr)
      alert(findErr.message)
      return false
    }

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("skill_assessments")
        .update({
          answers: cleanAnswers,
          completed,
        })
        .eq("id", existing.id)

      if (upErr) {
        console.error(upErr)
        alert(upErr.message)
        return false
      }
    } else {
      const { error: insErr } = await supabase.from("skill_assessments").insert({
        tenant_id: ctx.tenantId,
        worker_id: workerId,
        category: CATEGORY_SLUG,
        answers: cleanAnswers,
        completed,
      })

      if (insErr) {
        console.error(insErr)
        const e = insErr as { code?: string; message?: string }
        if (e.code === "23505" && (e.message || "").includes("skill_assessments_worker_id_key")) {
          alert(
            'Database constraint is still UNIQUE(worker_id). Apply the migration that replaces it with UNIQUE(worker_id, category) (see supabase/migrations/20260410194500_create_skill_assessments.sql), then try again.'
          )
        } else {
          alert(insErr.message)
        }
        return false
      }
    }

    if (completed) {
      localStorage.setItem("monitoring_done", "true")
    }
    return true
  }

  async function saveAndFinish() {
    await flushPending()
    if (!quizFullyComplete()) {
      alert("Please answer all questions before finishing this section.")
      return
    }
    setSaving(true)
    try {
      const ok = await persist(true)
      if (ok) router.push("/application/step-3-assessment")
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    if (questions.length === 0) {
      router.push("/application/step-3-assessment")
      return
    }

    await flushPending()

    if (page >= totalPages) {
      await saveAndFinish()
      return
    }

    setPage((p) => p + 1)
  }

  function back() {
    if (page > 1) setPage((p) => p - 1)
    else router.back()
  }

  if (loading) {
    return <OnboardingLoader label="Loading your skill quiz..." />
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-600 text-white p-6 gap-4">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void loadQuiz()}
          className="underline font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-600 p-6 text-center">
        <p className="text-white mb-4">
          No category found with id{" "}
          <code className="bg-white/10 px-1 rounded">{MONITORING_CATEGORY_ID}</code>. Add or fix the
          Monitoring row in <code className="bg-white/10 px-1 rounded">skill_categories</code> (slug{" "}
          <code className="bg-white/10 px-1 rounded">{CATEGORY_SLUG}</code>).
        </p>
        <button
          type="button"
          onClick={() => router.push("/application/step-3-assessment")}
          className="text-white underline"
        >
          Back to categories
        </button>
      </div>
    )
  }

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/skill-bg.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={3} completedThrough={2} />

        <div className="flex flex-1 flex-col pt-8">
          <div className="mb-1 flex items-start justify-between">
            <div>
              <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
                {category.title}
              </h2>
              {category.description ? (
                <p className="mt-2 text-[13px] text-slate-500">
                  {category.description}
                </p>
              ) : null}
            </div>
            <div className="mt-1 flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <AutosaveStatus state={saveState} />
              <button
                type="button"
                onClick={() => router.push("/application/step-4-documents")}
                className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488]"
              >
                Skip for Now →
              </button>
            </div>
          </div>

          <div className="mt-4 mb-1 flex items-center justify-between border-b border-slate-200 pb-2">
            <p className="w-full text-[13px] font-bold text-slate-800">Skills</p>
            <div className="shrink-0 pr-1 flex gap-6">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className="w-5 text-center text-[13px] font-semibold text-slate-600"
                >
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pageQuestions.map((q, i) => {
              const index = start + i
              const display = splitQuestionDetail(q.question, q.description)
              return (
                <div key={q.id} className="flex items-center justify-between py-4">
                  <div className="flex flex-1 min-w-0 items-start gap-3 pr-6">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#0D9488] text-[11px] font-semibold text-[#0D9488]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-slate-800">
                        {display.title}
                      </p>
                      {display.detail ? (
                        <p className="text-[11px] text-slate-400">{display.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0 pr-1 flex gap-6">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => selectAnswer(q.id, n)}
                        className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-[5px] border-2 transition ${
                          answers[q.id] === n
                            ? "border-[#0D9488] bg-[#0D9488]"
                            : "border-slate-300 bg-white hover:border-[#0D9488]"
                        }`}
                      >
                        {answers[q.id] === n && (
                          <span className="h-2 w-2 rounded-[2px] bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-auto flex items-center justify-between pt-6">
            <span className="text-[13px] font-medium text-slate-600">
              {questions.length === 0 ? "—" : `${page} of ${totalPages}`}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={saving || questions.length === 0}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#0D9488] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#0b7a70] disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : questions.length === 0
                    ? "Continue"
                    : page >= totalPages
                      ? "Save & Next"
                      : "Save & Next"}
                {!saving && (
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}