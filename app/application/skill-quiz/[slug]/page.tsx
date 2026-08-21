"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getApplicantSupabaseClient } from "@/lib/supabase-applicant-browser"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import { useSkipSkillAssessment } from "@/lib/onboarding/use-skip-skill-assessment"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import { fetchApplicantSkillAnswers, persistSkillAssessment } from "@/lib/skill-assessment-answer-rows"
import { useQuizAutosave } from "@/lib/useQuizAutosave"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import {
  SKILL_QUIZ_CONTENT_CLASS,
  SKILL_QUIZ_SHELL_CLASS,
} from "@/app/application/skill-quiz/skill-quiz-responsive"
import {
  clampSkillQuizPage,
  getSkillQuizPageQuestions,
  getSkillQuizTotalPages,
} from "@/lib/skill-quiz-pagination"
import { resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug"
import { findSkillCategoryBySlug, normalizeSkillAssessmentCatalog } from "@/lib/skill-assessment/catalog"
import { createDefaultSkillAssessmentCatalog } from "@/lib/skill-assessment/defaults"
import { isCategoryComplete, isValidRatingAnswer } from "@/lib/skill-assessment/score"
import type {
  SkillCategoryDraft,
  SkillQuizAnswerValue,
  SkillQuizAnswers,
} from "@/lib/skill-assessment/types"
import SkillQuizForm from "@/app/application/components/SkillQuizForm"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"

const PAGE_SIZE = 5
const supabase = getApplicantSupabaseClient()

function coerceAnswers(raw: unknown): SkillQuizAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: SkillQuizAnswers = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" || typeof value === "string") out[key] = value
    else if (Array.isArray(value)) out[key] = value.map(String)
  }
  return out
}

export default function SkillQuizBySlugPage() {
  const params = useParams()
  const slug = decodeURIComponent(String(params.slug ?? ""))
  const branding = useTenantBranding()
  const router = useRouter()
  const nav = useOnboardingStepNav()
  const onboarding = useOnboardingConfigOptional()
  const { skipSkillAssessment } = useSkipSkillAssessment()
  const allowSkip = onboarding?.config?.skillAssessmentSettings?.allowSkip !== false

  const [category, setCategory] = useState<SkillCategoryDraft | null>(null)
  const [answers, setAnswers] = useState<SkillQuizAnswers>({})
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const answersRef = useRef<SkillQuizAnswers>({})
  const pageRef = useRef(page)
  const questions = category?.questions ?? []
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  useEffect(() => {
    pageRef.current = page
  }, [page])

  const { scheduleSave, saveState, flushPending } = useQuizAutosave(supabase, {
    categorySlug: slug,
    answersRef,
  })

  const { pageQuestions, safePage, totalPages, start } = getSkillQuizPageQuestions(
    questions,
    page,
    PAGE_SIZE
  )

  const loadQuiz = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const search = typeof window !== "undefined" ? window.location.search : ""
      const tenantSlug = resolveClientOnboardingTenantSlug(search)
      const query = new URLSearchParams()
      if (tenantSlug) query.set("slug", tenantSlug)
      const res = await fetch(`/api/onboarding/skill-assessment-catalog?${query.toString()}`, {
        cache: "no-store",
      })
      const payload = (await res.json().catch(() => null)) as { catalog?: unknown; enabled?: boolean } | null
      if (!res.ok) throw new Error((payload as { error?: string } | null)?.error || "Failed to load assessment")
      if (payload?.enabled === false) {
        if (nav.nextRoute) router.replace(nav.nextRoute)
        return
      }
      const nextCatalog = payload?.catalog
        ? normalizeSkillAssessmentCatalog(payload.catalog)
        : createDefaultSkillAssessmentCatalog()
      const nextCategory = findSkillCategoryBySlug(nextCatalog, slug)
      setCategory(nextCategory)
      if (!nextCategory) {
        setLoading(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      const applicantFromLs =
        typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
      if (!user && !applicantFromLs) {
        setLoading(false)
        return
      }

      const { data: row } = await supabase
        .from("skill_assessments")
        .select("answers")
        .eq("category", slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const fromJson = coerceAnswers(row?.answers)
      const ratingLegacy: Record<string, number> = {}
      for (const [key, value] of Object.entries(fromJson)) {
        if (isValidRatingAnswer(value)) ratingLegacy[key] = value
      }
      const mergedRating = await fetchApplicantSkillAnswers(supabase, nextCategory.id, ratingLegacy)
      setAnswers({ ...fromJson, ...mergedRating })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load quiz"
      setLoadError(msg)
      console.error("[skill quiz]", e)
    } finally {
      setLoading(false)
    }
  }, [nav.nextRoute, router, slug])

  useEffect(() => {
    void loadQuiz()
  }, [loadQuiz])

  useEffect(() => {
    setPage((p) => clampSkillQuizPage(p, questions.length, PAGE_SIZE))
  }, [questions.length])

  const selectAnswer = (questionId: string, value: SkillQuizAnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value }
      answersRef.current = next
      return next
    })
    if (category?.id) scheduleSave(questionId, value, category.id)
  }

  async function persist(completed: boolean) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const applicantFromLs =
      typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
    const uid = userData?.user?.id ?? applicantFromLs
    if (userError || !uid) {
      if (completed && typeof window !== "undefined") localStorage.setItem(`${slug}_done`, "true")
      return true
    }

    const result = await persistSkillAssessment(supabase, {
      categorySlug: slug,
      answers,
      completed,
    })
    if (!result.ok) {
      alert(result.error)
      return false
    }
    if (completed && typeof window !== "undefined") localStorage.setItem(`${slug}_done`, "true")
    return true
  }

  async function saveAndFinish() {
    await flushPending()
    if (category && !isCategoryComplete(category, answers)) {
      alert("Please answer all required questions before finishing this section.")
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
    const pages = getSkillQuizTotalPages(questions.length, PAGE_SIZE)
    if (pageRef.current >= pages) {
      await saveAndFinish()
      return
    }
    setPage(pageRef.current + 1)
  }

  function back() {
    if (safePage > 1) setPage(safePage - 1)
    else router.push(applicationPath(APPLICATION_ROUTES.skillAssessment))
  }

  if (loading) {
    return (
      <OnboardingLayout
        cardClassName="min-[700px]:h-auto min-[700px]:min-h-[540px] min-[1200px]:min-h-[700px]"
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
        <button type="button" onClick={() => void loadQuiz()} className="underline font-medium">
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
        <p className="mb-4 text-white">This skill category is not available.</p>
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
      cardClassName="min-[700px]:h-auto min-[700px]:min-h-[540px] min-[1200px]:min-h-[700px]"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className={SKILL_QUIZ_SHELL_CLASS} style={brandingToCssVars(branding)}>
        <OnboardingStepper />
        <div className={SKILL_QUIZ_CONTENT_CLASS}>
          <SkillQuizForm
            category={category}
            pageQuestions={pageQuestions}
            startIndex={start}
            answers={answers}
            onAnswer={selectAnswer}
            pageLabel={questions.length === 0 ? "—" : `${safePage} of ${totalPages}`}
            allowSkip={allowSkip}
            onSkip={skipSkillAssessment}
            onBack={back}
            onNext={() => void next()}
            nextLabel={saving ? "Saving..." : "Save & Next"}
            saving={saving}
            autosaveSlot={<AutosaveStatus state={saveState} />}
          />
        </div>
      </div>
    </OnboardingLayout>
  )
}
