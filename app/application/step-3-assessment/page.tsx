"use client"

import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Check, ChevronRight } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingLoader from "@/app/components/OnboardingLoader"

type Category = {
  id: string
  title: string
  description: string | null
  order_number: number | null
  slug: string | null
}

function localCompletedCategories(): Set<string> {
  if (typeof window === "undefined") return new Set()
  const done = new Set<string>()
  if (localStorage.getItem("basic_care_done") === "true") done.add("basic-care")
  if (localStorage.getItem("mobility_done") === "true") done.add("mobility")
  if (localStorage.getItem("clinical_done") === "true") done.add("clinical")
  if (localStorage.getItem("monitoring_done") === "true") done.add("monitoring")
  if (localStorage.getItem("documentation_done") === "true") done.add("documentation")
  return done
}

/** If `slug` is null, map legacy `order_number` to existing static quiz routes. */
const LEGACY_ORDER_TO_SLUG: Record<number, string> = {
  1: "basic-care",
  2: "mobility",
  3: "clinical",
  4: "monitoring",
  5: "documentation",
}

/** Same slug as `skill_assessments.category` and the `/step-3-quiz/[slug]` route */
function categoryQuizSlug(cat: Category): string | null {
  const s = cat.slug?.trim()
  if (s) return s
  if (cat.order_number != null && LEGACY_ORDER_TO_SLUG[cat.order_number]) {
    return LEGACY_ORDER_TO_SLUG[cat.order_number]
  }
  return null
}

function quizHref(cat: Category): string | null {
  const slug = categoryQuizSlug(cat)
  if (!slug) return null
  return applicationPath(`/application/step-3-quiz/${encodeURIComponent(slug)}`)
}

function recordCompletedCategories(rows: { category: string }[]): Set<string> {
  const set = new Set<string>()
  for (const r of rows) {
    set.add(r.category)
    if (r.category === "basic_care") set.add("basic-care")
  }
  return set
}

export default function AssessmentPage() {
  const router = useRouter()
  const nav = useOnboardingStepNav()
  const [categories, setCategories] = useState<Category[]>([])
  const [completedSlugs, setCompletedSlugs] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    const { data, error } = await supabase
      .from("skill_categories")
      .select("id, title, description, order_number, slug")
      .order("order_number", { ascending: true, nullsFirst: false })

    if (error) {
      console.error("[step-3-assessment] skill_categories", error)
      setLoadError(error.message)
      setCategories([])
      setCompletedSlugs(new Set())
    } else {
      setCategories((data ?? []) as Category[])
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      const localDone = localCompletedCategories()
      if (!user) {
        setCompletedSlugs(localDone)
      } else {
        const { data: worker } = await supabase
          .from("worker")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle()
        const workerId = worker?.id ? String(worker.id) : user.id

        const { data: doneRows, error: aErr } = await supabase
          .from("skill_assessments")
          .select("category")
          // Support both legacy rows (worker_id=user.id) and current rows (worker_id=worker.id)
          .in("worker_id", [workerId, user.id])
          .eq("completed", true)

        if (aErr) {
          console.error("[step-3-assessment] skill_assessments", aErr)
          setCompletedSlugs(localDone)
        } else {
          const combined = recordCompletedCategories(doneRows ?? [])
          for (const slug of localDone) combined.add(slug)
          setCompletedSlugs(combined)
        }
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const goToCategory = (cat: Category) => {
    const href = quizHref(cat)
    if (href) router.push(href)
  }

  if (loading) {
    return <OnboardingLoader label="Loading skill categories..." />
  }

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/skill-bg.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
              Skill Assessment Quiz
            </h2>
            <button
              type="button"
              onClick={() => nav.nextRoute && router.push(nav.nextRoute)}
              className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488] mt-1"
            >
              Skip for Now →
            </button>
          </div>
          <p className="text-[13px] text-slate-500 mb-6">Identify Strengths. Verify Readiness.</p>

          {loadError ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
              Could not load skill categories: {loadError}
            </div>
          ) : null}
          {!loadError && categories.length === 0 ? (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              No skill categories returned from the server. Confirm your Supabase URL and anon key match
              the project where <code className="rounded bg-white/70 px-1">skill_categories</code> rows
              exist, RLS policies allow <code className="rounded bg-white/70 px-1">anon</code> SELECT, then
              refresh.
            </div>
          ) : null}

          {/* Category list */}
          <div className="space-y-3">
            {categories.map((cat, index) => {
              const slug = categoryQuizSlug(cat)
              const isCompleted = Boolean(slug && completedSlugs.has(slug))
              return (
                <div
                  key={cat.id}
                  onClick={() => goToCategory(cat)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-4 cursor-pointer transition ${
                    isCompleted
                      ? "border-[#0D9488] bg-[#ecfffd]"
                      : "border-[#0D9488] bg-white hover:bg-[#f0fffe]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold ${
                        isCompleted
                          ? "border-[#0D9488] bg-[#0D9488] text-white"
                          : "border-[#0D9488] text-[#0D9488]"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-slate-800">{cat.title}</p>
                      <p className="text-[12px] text-slate-500">{cat.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#0D9488]" />
                </div>
              )
            })}
          </div>

          {/* Buttons */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (nav.nextRoute) router.push(nav.nextRoute)
              }}
              className="cursor-pointer rounded-md bg-[#0D9488] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#0b7a70]"
            >
              Save &amp; continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
