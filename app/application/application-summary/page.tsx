"use client"

import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Circle, CircleAlert, Pencil } from "lucide-react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingSuccessPopup from "@/app/components/OnboardingSuccessPopup"
import { countCompleteReferencesFromStorage } from "@/lib/referencesValidation"
import {
  buildApplicantSummarySections,
  createApplicantSummarySnapshot,
  evaluateApplicantSummaryReadiness,
  type ApplicantSummarySnapshot,
} from "@/lib/onboarding/applicant-summary-sections"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import type { SkillCategoryRow } from "@/lib/onboardingSummaryData"
import { readAuthorizationSigningState } from "@/lib/onboardingSummaryData"

function SummaryRow({
  title,
  subtitle,
  complete,
  editHref,
}: {
  title: string
  subtitle?: string | null
  complete: boolean
  editHref?: string
}) {
  return (
    <div
      className={`group flex items-center justify-between rounded-xl border px-4 py-3 ${
        complete ? "border-[#0D9488] bg-[#f0fffe]" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {complete ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0D9488]" aria-hidden />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          {subtitle ? (
            <p className={`text-[11px] ${complete ? "text-[#0D9488]" : "text-slate-500"}`}>{subtitle}</p>
          ) : null}
        </div>
      </div>
      {editHref ? (
        <Link
          href={editHref}
          aria-label={`Edit ${title}`}
          className="shrink-0 rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-600"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  )
}

export default function SummaryPage() {
  const router = useRouter()
  const nav = useOnboardingStepNav()

  const [snapshot, setSnapshot] = useState<ApplicantSummarySnapshot>(() =>
    createApplicantSummarySnapshot()
  )
  const [submitGuardError, setSubmitGuardError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showIncompleteWarningModal, setShowIncompleteWarningModal] = useState(false)
  /** After mount, safe to read localStorage during render (legacy skill counts). */
  const [clientStorageReady, setClientStorageReady] = useState(false)
  /** Single ref for async handlers; synced each render after `allSectionsReady` is computed. */
  const submissionReadinessRef = useRef(false)
  const incompleteModalRef = useRef<HTMLDivElement>(null)

  const loadSnapshot = useCallback(async () => {
    if (typeof window === "undefined") return

    setSubmitGuardError(null)
    const base = createApplicantSummarySnapshot()
    base.authState = readAuthorizationSigningState()
    base.referencesCount = countCompleteReferencesFromStorage()

    try {
      const raw = localStorage.getItem("identityDocuments")
      if (raw?.trim()) {
        const parsed = JSON.parse(raw) as ApplicantSummarySnapshot["identityLs"]
        base.identityLs = parsed && typeof parsed === "object" ? parsed : null
      } else {
        base.identityLs = null
      }
    } catch {
      base.identityLs = null
    }

    const applicantId = localStorage.getItem("applicantId")?.trim() || ""
    if (applicantId) {
      try {
        const res = await fetch(
          `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}`,
        )
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          documents?: ApplicantSummarySnapshot["workerDocs"]
        }
        if (res.ok && json.documents) {
          base.workerDocs = json.documents
        } else {
          base.workerDocs = null
        }
      } catch {
        base.workerDocs = null
      }
    } else {
      base.workerDocs = null
    }

    try {
      const res = await fetch("/api/skill-categories")
      const json = (await res.json().catch(() => [])) as unknown
      if (!res.ok) {
        base.skillLoadError =
          typeof json === "object" && json && "error" in json
            ? String((json as { error: string }).error)
            : "Failed to load categories"
        base.skillCategories = []
        setSnapshot({ ...base })
        return
      }
      base.skillLoadError = null
      base.skillCategories = Array.isArray(json) ? (json as SkillCategoryRow[]) : []
    } catch (e) {
      base.skillLoadError = e instanceof Error ? e.message : "Failed to load categories"
      base.skillCategories = []
    }
    setSnapshot({ ...base })
  }, [])

  useEffect(() => {
    setClientStorageReady(true)
    void loadSnapshot()
    const onFocus = () => void loadSnapshot()
    const onStorage = () => void loadSnapshot()
    window.addEventListener("focus", onFocus)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("storage", onStorage)
    }
  }, [loadSnapshot])

  useEffect(() => {
    if (!showIncompleteWarningModal) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const panel = incompleteModalRef.current
    const getFocusable = () => {
      if (!panel) return [] as HTMLElement[]
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"))
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setShowIncompleteWarningModal(false)
        return
      }
      if (e.key !== "Tab" || !panel) return
      const active = document.activeElement
      if (active && !panel.contains(active)) return

      const list = getFocusable()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    const raf = window.requestAnimationFrame(() => {
      document.getElementById("summary-incomplete-primary")?.focus()
    })

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
      window.cancelAnimationFrame(raf)
    }
  }, [showIncompleteWarningModal])

  const summarySnapshot = useMemo(
    () => ({ ...snapshot, clientStorageReady }),
    [snapshot, clientStorageReady]
  )

  const summarySections = useMemo(
    () => buildApplicantSummarySections(nav.config, nav.slug, summarySnapshot),
    [nav.config, nav.slug, summarySnapshot]
  )

  const { allReady: allSectionsReady, incomplete: incompleteSections } = useMemo(
    () => evaluateApplicantSummaryReadiness(nav.config, summarySections),
    [nav.config, summarySections]
  )

  const completedSections = summarySections.filter((s) => s.complete).length
  const totalSections = summarySections.length

  submissionReadinessRef.current = allSectionsReady

  const handleFinalSubmit = () => {
    setSubmitGuardError(null)
    if (!submissionReadinessRef.current) {
      setShowIncompleteWarningModal(true)
      return
    }
    setLoading(true)
    setSuccess(true)
    setTimeout(() => {
      if (!submissionReadinessRef.current) {
        setSuccess(false)
        setLoading(false)
        setShowIncompleteWarningModal(true)
        return
      }
      localStorage.removeItem("parsedResume")
      localStorage.removeItem("identityDocuments")
      localStorage.removeItem("skillStatus")
      localStorage.removeItem("referencesCount")
      localStorage.removeItem("referenceData")
      localStorage.removeItem("referenceDataDraft")
      router.push(applicationPath("/application/success"))
    }, 3000)
  }

  return (
    <>
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/main-doctor.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper />

        <div className="flex flex-1 flex-col pt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">Summary</h2>
            <span className="text-[12px] font-medium text-slate-500">
              {completedSections} of {totalSections} sections complete
            </span>
          </div>

          <div className="space-y-6">
            {summarySections.map((section) => (
              <div key={section.id}>
                <p className="mb-2 text-[13px] font-semibold text-slate-700">{section.heading}</p>
                <div className="space-y-2">
                  {section.rows.map((row) => (
                    <SummaryRow
                      key={row.key}
                      title={row.title}
                      subtitle={row.subtitle}
                      complete={row.complete}
                      editHref={section.editHref}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {submitGuardError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {submitGuardError}
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => (nav.prevRoute ? router.push(nav.prevRoute) : router.back())}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading}
              className={`rounded-md px-6 py-2 text-[12px] font-medium leading-5 text-white transition ${
                loading ? "cursor-not-allowed bg-gray-400 opacity-70" : "cursor-pointer bg-[#0D9488] hover:bg-[#0b7a70]"
              }`}
            >
              {loading ? "Finalizing..." : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
      <OnboardingSuccessPopup
        open={success}
        onContinue={() => {
          if (!submissionReadinessRef.current) {
            setSuccess(false)
            setLoading(false)
            setShowIncompleteWarningModal(true)
            return
          }
          localStorage.removeItem("parsedResume")
          localStorage.removeItem("identityDocuments")
          localStorage.removeItem("skillStatus")
          localStorage.removeItem("referencesCount")
          localStorage.removeItem("referenceData")
          localStorage.removeItem("referenceDataDraft")
          router.push(applicationPath("/application/success"))
        }}
      />
    </OnboardingLayout>

    {showIncompleteWarningModal ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-3 sm:p-4"
        onClick={() => setShowIncompleteWarningModal(false)}
        role="presentation"
        aria-hidden
      >
        <div
          ref={incompleteModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="incomplete-modal-title"
          aria-describedby="incomplete-modal-desc"
          className="max-h-[90vh] w-[95%] max-w-[520px] overflow-y-auto rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.14),0_4px_12px_-4px_rgba(15,23,42,0.08)] sm:w-[90%] sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2
            id="incomplete-modal-title"
            className="text-[22px] font-bold leading-tight tracking-tight text-[#111827] sm:text-2xl"
          >
            Complete Required Sections
          </h2>
          <p
            id="incomplete-modal-desc"
            className="mt-3 text-[15px] leading-relaxed text-[#4B5563] sm:text-base"
          >
            Some sections are still incomplete. Please finish them before continuing.
          </p>

          {incompleteSections.length > 0 ? (
            <ul
              className="mt-5 list-none space-y-3.5 sm:mt-6"
              aria-label="Incomplete sections"
            >
              {incompleteSections.map((s) => (
                <li key={s.id} className="flex gap-3 break-words">
                  <CircleAlert
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-500"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <Link
                    href={s.href}
                    className="min-w-0 flex-1 text-left text-[15px] font-medium leading-snug text-[#374151] underline-offset-2 transition hover:text-[#2563EB] hover:underline focus:outline-none focus-visible:rounded-sm focus-visible:text-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2 sm:text-base"
                    onClick={() => setShowIncompleteWarningModal(false)}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={() => setShowIncompleteWarningModal(false)}
              className="w-full rounded-lg border border-[#D1D5DB] bg-[#FFFFFF] px-4 py-2.5 text-sm font-semibold text-[#374151] transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2 sm:w-auto sm:min-w-[7.5rem]"
            >
              Close
            </button>
            <button
              id="summary-incomplete-primary"
              type="button"
              disabled={incompleteSections.length === 0}
              onClick={() => {
                const first = incompleteSections[0]
                setShowIncompleteWarningModal(false)
                if (first?.href) router.push(first.href)
              }}
              style={{ backgroundColor: "#0F766E", color: "#FFFFFF" }}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}
