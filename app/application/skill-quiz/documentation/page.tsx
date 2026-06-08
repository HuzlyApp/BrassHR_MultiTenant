"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { DOCUMENTATION_CATEGORY_ID } from "@/lib/documentation-category"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import OnboardingLoader from "@/app/components/OnboardingLoader"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import { ChevronRight } from "lucide-react"
import {
  mergeQuestionCatalogWithDb,
  remapLegacySyntheticAnswerKeys,
} from "@/lib/merge-skill-quiz-catalog"
import { getWorkerSessionContext } from "@/lib/onboarding-worker-pk"
import { fetchApplicantSkillAnswers } from "@/lib/skill-assessment-answer-rows"
import { useQuizAutosave } from "@/lib/useQuizAutosave"
import AutosaveStatus from "@/app/components/AutosaveStatus"

/** `skill_assessments.worker_id` = auth user id; `category` matches `skill_categories.slug` */
const CATEGORY_SLUG = "documentation"
const PAGE_SIZE = 5
const DISPLAY_TITLE = "Professional Practices & Documentation"
const DISPLAY_SUBTITLE = "Ethical standards, record-keeping, and care coordination"
const DOCUMENTATION_QUESTION_CONTENT = [
  {
    quiz_number: 1,
    question: "Infection control precautions",
    description:
      "(various types: standard universal, reverse isolation, TB/airborne, COVID/MRSA/VRE)",
  },
  {
    quiz_number: 2,
    question: "Specimen collection",
    description:
      "(various types: routine urine, clean catch, 12/24-hour, stool, culture, sputum)",
  },
  {
    quiz_number: 3,
    question: "Admission of patients",
    description: null,
  },
  {
    quiz_number: 4,
    question: "Discharge patients",
    description: null,
  },
  {
    quiz_number: 5,
    question: "Patient care plans",
    description: "(revise and update)",
  },
  {
    quiz_number: 6,
    question: "Charting",
    description: "(includes computerized charting)",
  },
  {
    quiz_number: 7,
    question: "EHR medical record competency",
    description: "(specifically PCC use; other EHR systems-list below if applicable)",
  },
  {
    quiz_number: 8,
    question: "Urine test for glucose/ acetone",
    description: null,
  },
  {
    quiz_number: 9,
    question: "Transfer/ transport patients: gurney",
    description: null,
  },
  {
    quiz_number: 10,
    question: "Traction",
    description: null,
  },
] as const

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

function splitQuestionDetail(question: string, description?: string | null) {
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

export default function DocumentationQuiz() {
  const branding = useTenantBranding()
  const router = useRouter()
  const nav = useOnboardingStepNav()
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
        .eq("id", DOCUMENTATION_CATEGORY_ID)
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
      let displayQuestions: QuestionRow[]
      try {
        displayQuestions = mergeQuestionCatalogWithDb(DOCUMENTATION_QUESTION_CONTENT, ordered)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not load quiz questions from the database"
        setLoadError(msg)
        setQuestions([])
        setLoading(false)
        return
      }
      setQuestions(displayQuestions)

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

      let legacy = normalizeAnswers(row?.answers ?? null, displayQuestions)
      legacy = remapLegacySyntheticAnswerKeys(legacy, displayQuestions, "documentation")
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
      console.error("[documentation quiz]", e)
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

  function quizFullyComplete() {
    return questions.length > 0 && questions.every((q) => answers[q.id] != null)
  }

  async function persist(completed: boolean) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const applicantFromLs =
      typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
    const uid = userData?.user?.id ?? applicantFromLs
    if (userError || !uid) {
      if (completed) localStorage.setItem("documentation_done", "true")
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
      localStorage.setItem("documentation_done", "true")
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
    return <OnboardingLoader label="Loading your skill quiz..." />
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
          <code className="bg-white/10 px-1 rounded">{DOCUMENTATION_CATEGORY_ID}</code>. Add or fix the
          Documentation row in <code className="bg-white/10 px-1 rounded">skill_categories</code> (slug{" "}
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
      <div className="flex h-full flex-col px-10 pb-10 pt-8" style={brandingToCssVars(branding)}>
        <OnboardingStepper />

        <div className="flex flex-1 flex-col pt-8">
          <div className="mb-1 flex items-start justify-between">
            <div>
              <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
                {DISPLAY_TITLE}
              </h2>
              <p className="mt-2 text-[13px] text-slate-500">{DISPLAY_SUBTITLE}</p>
            </div>
            <div className="mt-1 flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <AutosaveStatus state={saveState} />
              <button
                type="button"
                onClick={() => nav.nextRoute && router.push(nav.nextRoute)}
                className="cursor-pointer text-[12px] font-medium leading-5 text-[color:var(--brand-primary)]"
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
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-primary)] text-[11px] font-semibold text-[color:var(--brand-primary)]">
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
                            ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]"
                            : "border-slate-300 bg-white hover:border-[color:var(--brand-primary)]"
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
                className="cursor-pointer rounded-md border border-[color:var(--brand-primary)] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={saving || questions.length === 0}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-[color:var(--brand-primary)] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:brightness-90 disabled:opacity-50"
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