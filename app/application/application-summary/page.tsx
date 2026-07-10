"use client"

import { applicationPath } from "@/lib/tenant/with-tenant"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Circle, CircleAlert, Pencil } from "lucide-react"
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_CONTENT_CLASS,
  APPLICANT_HEADER_ROW,
  APPLICANT_SHELL_CLASS,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import OnboardingSuccessPopup from "@/app/components/OnboardingSuccessPopup"
import { countCompleteReferencesFromStorage } from "@/lib/referencesValidation"
import type { SummaryDisplayStatus } from "@/lib/onboarding/applicant-summary-sections"
import {
  buildApplicantSummarySections,
  createApplicantSummarySnapshot,
  evaluateApplicantSummaryReadiness,
  type ApplicantSummarySnapshot,
} from "@/lib/onboarding/applicant-summary-sections"
import { readAuthorizationSigningState, mergeAuthorizationSigningState, signingStateFromFirmaStatus } from "@/lib/onboardingSummaryData"
import { stepUsesFirmaSigning } from "@/lib/onboarding/firma-step-settings"
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import { useMarkStepInProgressIfPending } from "@/lib/onboarding/use-mark-step-in-progress-if-pending"
import type { SkillCategoryRow } from "@/lib/onboardingSummaryData"

function SummaryRow({
  title,
  subtitle,
  complete,
  stepStatus,
  editHref,
}: {
  title: string
  subtitle?: string | null
  complete: boolean
  stepStatus?: SummaryDisplayStatus
  editHref?: string
}) {
  const status: SummaryDisplayStatus = stepStatus ?? (complete ? "completed" : "incomplete")
  const isSkipped = status === "skipped"
  const isRequiredMissing = status === "required_missing"
  const isIncomplete = status === "incomplete" || isRequiredMissing

  return (
    <div
      className={`group flex items-center justify-between rounded-xl border px-4 py-3 ${
        complete
          ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/5"
          : isSkipped
            ? "border-slate-200 bg-slate-100"
            : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {complete ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--brand-primary)]" aria-hidden />
        ) : isSkipped ? (
          <Circle className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <CircleAlert className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-800">{title}</p>
            {isSkipped ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Skipped
              </span>
            ) : isRequiredMissing ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Required
              </span>
            ) : isIncomplete ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Incomplete
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p
              className={`text-[11px] ${
                complete
                  ? "text-[color:var(--brand-primary)]"
                  : isSkipped
                    ? "text-slate-500"
                    : "text-amber-800"
              }`}
            >
              {subtitle}
            </p>
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
  const branding = useTenantBranding()
  const router = useRouter()
  const nav = useOnboardingStepNav()
  const onboarding = useOnboardingConfigOptional()

  const [snapshot, setSnapshot] = useState<ApplicantSummarySnapshot>(() =>
    createApplicantSummarySnapshot()
  )
  const [submitGuardError, setSubmitGuardError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  /** After mount, safe to read localStorage during render (legacy skill counts). */
  const [clientStorageReady, setClientStorageReady] = useState(false)

  const reviewStep = useMemo(
    () =>
      nav.enabledSteps?.find(
        (step) => step.step_type === "review_submit" || step.step_key === "review_submit"
      ) ?? null,
    [nav.enabledSteps]
  )

  useMarkStepInProgressIfPending({
    step: reviewStep,
    disabled: nav.configLoading,
    updateStepStatus: onboarding?.updateStepStatus,
  })

  const loadSnapshot = useCallback(async () => {
    if (typeof window === "undefined") return

    setSubmitGuardError(null)
    const base = createApplicantSummarySnapshot()
    base.referencesCount = countCompleteReferencesFromStorage()
    const tenantSlug = nav.slug?.trim() || ""

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
      const tenantQuery = tenantSlug ? `&tenant=${encodeURIComponent(tenantSlug)}` : ""
      try {
        const res = await fetch(
          `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}${tenantQuery}`,
          { cache: "no-store" }
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

      try {
        const res = await fetch(
          `/api/onboarding/submitted-documents?applicantId=${encodeURIComponent(applicantId)}${tenantQuery}`,
          { cache: "no-store" }
        )
        const json = (await res.json().catch(() => ({}))) as {
          documents?: ApplicantSummarySnapshot["submittedDocuments"]
        }
        base.submittedDocuments = Array.isArray(json.documents) ? json.documents : []
      } catch {
        base.submittedDocuments = []
      }

      let serverAuthState = null
      const enabledSteps = getEnabledTenantSteps(nav.config)
      const authStep =
        enabledSteps.find((s) => s.step_type === "authorizations" && stepUsesFirmaSigning(s)) ??
        enabledSteps.find((s) => s.step_type === "authorizations")
      if (authStep) {
        try {
          const query = new URLSearchParams({
            applicantId,
            stepKey: authStep.step_key,
            stepId: authStep.id,
          })
          if (tenantSlug) query.set("tenantSlug", tenantSlug)
          const signingRequestId = localStorage.getItem("signingRequestId")?.trim()
          if (signingRequestId) query.set("signingRequestId", signingRequestId)
          const res = await fetch(`/api/onboarding/firma-sign/status?${query.toString()}`, {
            cache: "no-store",
          })
          const json = (await res.json().catch(() => ({}))) as {
            completed?: boolean
            session?: { firma_status?: string | null }
          }
          if (res.ok) {
            const firmaStatus = json.session?.firma_status
            if (json.completed || firmaStatus) {
              serverAuthState = json.completed
                ? signingStateFromFirmaStatus(firmaStatus ?? "signed")
                : signingStateFromFirmaStatus(firmaStatus)
            }
          }
        } catch {
          /* ignore firma hydration errors */
        }
      }
      base.authState = mergeAuthorizationSigningState(
        readAuthorizationSigningState(),
        serverAuthState
      )
    } else {
      base.workerDocs = null
      base.submittedDocuments = []
      base.authState = readAuthorizationSigningState()
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
  }, [nav.config, nav.slug])

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
    if (!onboarding?.progressHydrated) return
    void loadSnapshot()
  }, [loadSnapshot, onboarding?.progressHydrated, onboarding?.progress])

  const summarySnapshot = useMemo(
    () => ({ ...snapshot, clientStorageReady }),
    [snapshot, clientStorageReady]
  )

  const summarySections = useMemo(
    () => buildApplicantSummarySections(nav.config, nav.slug, summarySnapshot, onboarding?.progress ?? null),
    [nav.config, nav.slug, summarySnapshot, onboarding?.progress]
  )

  const { allReady: canSubmitOnboarding, incomplete: incompleteSections } = useMemo(
    () => evaluateApplicantSummaryReadiness(nav.config, summarySections),
    [nav.config, summarySections]
  );

  const completedSections = summarySections.filter((s) => s.complete).length;
  const totalSections = summarySections.length;
  const hasRequiredIncomplete = incompleteSections.length > 0;

  const clearLocalOnboardingDrafts = () => {
    localStorage.removeItem("parsedResume")
    localStorage.removeItem("identityDocuments")
    localStorage.removeItem("skillStatus")
    localStorage.removeItem("referencesCount")
    localStorage.removeItem("referenceData")
    localStorage.removeItem("referenceDataDraft")
  }

  const submitApplication = async () => {
    setSubmitGuardError(null)
    const applicantId = localStorage.getItem("applicantId")?.trim() || ""
    if (!applicantId) {
      setSubmitGuardError("Your session has expired. Please sign in again to submit your application.")
      return
    }

    const tenantSlug = nav.slug?.trim() || ""
    if (!tenantSlug) {
      setSubmitGuardError("Missing tenant context. Refresh the page and try again.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId, tenantSlug }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Could not submit your application.")
      }
      await onboarding?.refresh?.()
      setSuccess(true)
    } catch (e) {
      setSubmitGuardError(e instanceof Error ? e.message : "Could not submit your application.")
      setLoading(false)
    }
  }

  const handleFinalSubmit = () => {
    setSubmitGuardError(null)
    if (!canSubmitOnboarding) {
      setSubmitGuardError("Please complete all required steps before submitting your application.")
      return
    }
    void submitApplication()
  }

  const handleSuccessContinue = () => {
    clearLocalOnboardingDrafts()
    router.push(applicationPath("/application/success"))
  }

  return (
    <>
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className={APPLICANT_SHELL_CLASS} style={brandingToCssVars(branding)}>
        <OnboardingStepper />

        <div className={APPLICANT_CONTENT_CLASS}>
          <div className={`${APPLICANT_HEADER_ROW} mb-4 sm:mb-6`}>
            <h2 className={APPLICANT_TITLE_CLASS}>Summary</h2>
            <span className="shrink-0 text-[11px] font-medium text-slate-500 sm:text-[12px]">
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
                      stepStatus={row.stepStatus}
                      editHref={section.editHref}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {hasRequiredIncomplete ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Please complete all required steps before submitting your application.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {incompleteSections.map((section) => (
                  <li key={section.id}>
                    <Link href={section.href} className="font-medium text-[color:var(--brand-primary)] hover:underline">
                      {section.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {submitGuardError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {submitGuardError}
            </div>
          ) : null}

          <div className={APPLICANT_ACTION_ROW}>
            <button
              type="button"
              onClick={() => (nav.prevRoute ? router.push(nav.prevRoute) : router.back())}
              className="w-full cursor-pointer rounded-md border border-[color:var(--brand-primary)] bg-white px-4 py-2.5 text-[12px] font-medium leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 sm:w-auto sm:px-5 sm:py-2"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading || !canSubmitOnboarding}
              className={`w-full rounded-md px-4 py-2.5 text-[12px] font-medium leading-5 text-white transition sm:w-auto sm:px-6 sm:py-2 ${
                loading || !canSubmitOnboarding
                  ? "cursor-not-allowed bg-gray-400 opacity-70"
                  : "cursor-pointer bg-[color:var(--brand-primary)] hover:brightness-90"
              }`}
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </div>
      </div>
      <OnboardingSuccessPopup
        open={success}
        onContinue={handleSuccessContinue}
      />
    </OnboardingLayout>
    </>
  )
}
