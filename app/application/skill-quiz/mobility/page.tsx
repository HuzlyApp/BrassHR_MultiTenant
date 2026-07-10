"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser"
import { MOBILITY_CATEGORY_ID } from "@/lib/mobility-category"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import { useSkipSkillAssessment } from "@/lib/onboarding/use-skip-skill-assessment"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import { ChevronRight } from "lucide-react"
import { getSkillAssessmentWorkerKey } from "@/lib/onboarding-worker-pk"
import { fetchApplicantSkillAnswers, persistSkillAssessment } from "@/lib/skill-assessment-answer-rows"
import { useQuizAutosave } from "@/lib/useQuizAutosave"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import {
  QUIZ_ROW_GRID,
  RATING_TRACK_GRID,
  SKILL_QUIZ_CONTENT_CLASS,
  SKILL_QUIZ_SHELL_CLASS,
} from "@/app/application/skill-quiz/skill-quiz-responsive"

/** `skill_assessments.worker_id` = auth user id; `category` matches `skill_categories.slug` */
const CATEGORY_SLUG = "mobility"
const PAGE_SIZE = 5
const supabase = getApplicantSupabaseClient()

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

export default function MobilityQuiz() {
  const branding = useTenantBranding()
  const router = useRouter()
  const nav = useOnboardingStepNav()
  const { skipSkillAssessment } = useSkipSkillAssessment()
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
        .eq("id", MOBILITY_CATEGORY_ID)
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

      const workerId = (await getSkillAssessmentWorkerKey(supabase)) ?? uid

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
      console.error("[mobility quiz]", e)
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
      if (completed) localStorage.setItem("mobility_done", "true")
      return true
    }

    const result = await persistSkillAssessment(supabase, {
      categorySlug: CATEGORY_SLUG,
      answers,
      completed,
    })
    if (!result.ok) {
      alert(result.error)
      return false
    }

    if (completed) {
      localStorage.setItem("mobility_done", "true")
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
      if (ok) router.push(applicationPath(APPLICATION_ROUTES.skillAssessment))
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    if (questions.length === 0) {
      router.push(applicationPath(APPLICATION_ROUTES.skillAssessment))
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
    return (
      <OnboardingLayout
        cardClassName="md:h-auto md:min-h-[700px]"
        rightPanelImageClassName="opacity-60 object-top"
        rightPanelOverlayClassName="bg-white/65"
      >
        <div className={SKILL_QUIZ_SHELL_CLASS} style={brandingToCssVars(branding)}>
          <OnboardingStepper />
        </div>
      </OnboardingLayout>
    )
  }

  if (loadError) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-white"
        style={{ backgroundColor: branding.primaryHex }}
      >
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
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 text-center text-white"
        style={{ backgroundColor: branding.primaryHex }}
      >
        <p className="text-white mb-4">
          No category found with id{" "}
          <code className="bg-white/10 px-1 rounded">{MOBILITY_CATEGORY_ID}</code>. Add or fix the Mobility
          row in <code className="bg-white/10 px-1 rounded">skill_categories</code> (slug{" "}
          <code className="bg-white/10 px-1 rounded">{CATEGORY_SLUG}</code>).
        </p>
        <button
          type="button"
          onClick={() => router.push(applicationPath(APPLICATION_ROUTES.skillAssessment))}
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
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className={SKILL_QUIZ_SHELL_CLASS} style={brandingToCssVars(branding)}>
        <OnboardingStepper />

        <div className={SKILL_QUIZ_CONTENT_CLASS}>
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-7 text-slate-800 sm:text-[24px] sm:leading-8">
                {category.title}
              </h2>
              {category.description ? (
                <p className="mt-1 text-xs text-slate-500 sm:mt-2 sm:text-[13px]">
                  {category.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <AutosaveStatus state={saveState} />
              <button
                type="button"
                onClick={skipSkillAssessment}
                className="cursor-pointer text-[12px] font-medium leading-5 text-[color:var(--brand-primary)]"
              >
                Skip for Now →
              </button>
            </div>
          </div>

          <div className={`mb-1 mt-4 border-b border-slate-200 pb-2 ${QUIZ_ROW_GRID}`}>
            <p className="min-w-0 text-[12px] font-bold text-slate-800 sm:text-[13px]">Skills</p>
            <div className={RATING_TRACK_GRID}>
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="w-5 text-center text-[12px] font-semibold text-slate-600 sm:text-[13px]">
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div>
            {pageQuestions.map((q, i) => {
              const index = start + i
              const display = splitQuestionDetail(q.question, q.description)
              return (
                <div key={q.id} className={`border-b border-slate-100 py-3 sm:py-4 ${QUIZ_ROW_GRID}`}>
                  <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] text-[11px] font-semibold text-[color:var(--brand-primary)]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 break-words">
                      <p className="text-[12px] font-medium leading-5 text-slate-800 sm:text-[13px]">
                        {display.title}
                      </p>
                      {display.detail ? (
                        <p className="text-[11px] leading-4 text-slate-400">{display.detail}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={RATING_TRACK_GRID}>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => selectAnswer(q.id, n)}
                        className={`flex h-5 w-5 cursor-pointer items-center justify-center rounded-[5px] border-2 transition ${
                          answers[q.id] === n
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
                            : "border-slate-300 bg-white hover:border-[color:var(--brand-primary)]"
                        }`}
                        aria-label={`Rate ${display.title} as ${n}`}
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

          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] font-medium text-slate-600 sm:text-[13px]">
              {questions.length === 0 ? "—" : `${page} of ${totalPages}`}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={back}
                className="w-full cursor-pointer rounded-md border border-[color:var(--brand-primary)] bg-white px-3 py-2.5 text-[11px] font-medium leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 max-[399px]:px-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[12px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={saving || questions.length === 0}
                className="group inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[color:var(--brand-primary)] px-3 py-2.5 text-[11px] font-medium leading-5 text-white transition hover:brightness-90 disabled:opacity-50 max-[399px]:px-3 sm:w-auto sm:gap-2 sm:px-6 sm:py-2 sm:text-[12px]"
              >
                {saving
                  ? "Saving..."
                  : questions.length === 0
                    ? "Continue"
                    : page >= totalPages
                      ? "Save & continue"
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