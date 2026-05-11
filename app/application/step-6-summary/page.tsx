"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Circle, CircleAlert, Pencil } from "lucide-react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingSuccessPopup from "@/app/components/OnboardingSuccessPopup"
import {
  countCompleteReferencesFromStorage,
  MIN_COMPLETE_REFERENCES,
} from "@/lib/referencesValidation"
import {
  displayNameFromStoragePath,
  isSkillQuizDoneLocal,
  parseStep2Files,
  quizSlugForCategory,
  readAuthorizationSigningState,
  readResumeFileIndicators,
  step2HasAnyUpload,
  STEP2_FILE_TYPES,
  STEP2_REQUIREMENT_LABELS,
  type SkillCategoryRow,
  type Step2FileType,
  type Step2UploadedFile,
  countLocalLegacyQuizDone,
} from "@/lib/onboardingSummaryData"

type AuthSigningState = ReturnType<typeof readAuthorizationSigningState>

type WorkerDocumentsApi = {
  ssn_url?: string | null
  drivers_license_url?: string | null
} | null

type IdentityLs = {
  ssn?: { name?: string; url?: string }
  license?: { name?: string; url?: string }
} | null

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

function subtitleForSsnDl(path: string | null | undefined, fallbackName?: string | null): string | null {
  const p = path?.trim()
  if (p) return displayNameFromStoragePath(p)
  const n = fallbackName?.trim()
  return n || null
}

export default function SummaryPage() {
  const router = useRouter()

  /** SSR-safe defaults; real values load in `loadSnapshot` after mount to avoid hydration mismatch. */
  const [resumeInfo, setResumeInfo] = useState<{ fileName: string | null; hasUploadedFile: boolean }>(() => ({
    fileName: null,
    hasUploadedFile: false,
  }))
  const [step2Files, setStep2Files] = useState<Record<Step2FileType, Step2UploadedFile | null> | null>(null)
  const [skillCategories, setSkillCategories] = useState<SkillCategoryRow[]>([])
  const [skillLoadError, setSkillLoadError] = useState<string | null>(null)
  const [workerDocs, setWorkerDocs] = useState<WorkerDocumentsApi>(null)
  const [identityLs, setIdentityLs] = useState<IdentityLs>(null)
  const [authState, setAuthState] = useState<AuthSigningState>(() => ({
    statusRaw: "",
    display: "none",
    hasActivity: false,
  }))
  const [referencesCount, setReferencesCount] = useState(0)
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
    setResumeInfo(readResumeFileIndicators())
    setStep2Files(parseStep2Files())
    setAuthState(readAuthorizationSigningState())
    setReferencesCount(countCompleteReferencesFromStorage())

    try {
      const raw = localStorage.getItem("identityDocuments")
      if (raw?.trim()) {
        const parsed = JSON.parse(raw) as IdentityLs
        setIdentityLs(parsed && typeof parsed === "object" ? parsed : null)
      } else {
        setIdentityLs(null)
      }
    } catch {
      setIdentityLs(null)
    }

    const applicantId = localStorage.getItem("applicantId")?.trim() || ""
    if (applicantId) {
      try {
        const res = await fetch(
          `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}`,
        )
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          documents?: WorkerDocumentsApi
        }
        if (res.ok && json.documents) {
          setWorkerDocs(json.documents)
        } else {
          setWorkerDocs(null)
        }
      } catch {
        setWorkerDocs(null)
      }
    } else {
      setWorkerDocs(null)
    }

    try {
      const res = await fetch("/api/skill-categories")
      const json = (await res.json().catch(() => [])) as unknown
      if (!res.ok) {
        setSkillLoadError(typeof json === "object" && json && "error" in json ? String((json as { error: string }).error) : "Failed to load categories")
        setSkillCategories([])
        return
      }
      setSkillLoadError(null)
      const rows = Array.isArray(json) ? (json as SkillCategoryRow[]) : []
      setSkillCategories(rows)
    } catch (e) {
      setSkillLoadError(e instanceof Error ? e.message : "Failed to load categories")
      setSkillCategories([])
    }
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

  const skillProgress = (() => {
    const slugs = skillCategories
      .map((c) => quizSlugForCategory(c))
      .filter((s): s is string => Boolean(s))
    if (slugs.length === 0) {
      const fb = clientStorageReady ? countLocalLegacyQuizDone() : { completed: 0, total: 0 }
      return {
        completed: fb.completed,
        total: fb.total,
        label: skillLoadError
          ? `Could not load assessment list (${skillLoadError}). Showing progress saved on this device.`
          : fb.total > 0
            ? `${fb.completed} of ${fb.total} assessments completed (saved on this device)`
            : "No skill assessments recorded yet",
      }
    }
    const completed = slugs.filter((slug) => isSkillQuizDoneLocal(slug)).length
    const total = slugs.length
    return {
      completed,
      total,
      label: `${completed} of ${total} ${total === 1 ? "assessment" : "assessments"} completed`,
    }
  })()

  const ssnSubtitle = subtitleForSsnDl(workerDocs?.ssn_url, identityLs?.ssn?.name ?? null)
  const dlSubtitle = subtitleForSsnDl(workerDocs?.drivers_license_url, identityLs?.license?.name ?? null)
  const hasSsnDoc = Boolean(ssnSubtitle)
  const hasDlDoc = Boolean(dlSubtitle)

  const authAgreementSubtitle = (() => {
    if (authState.display === "signed") {
      return authState.statusRaw ? `Signed (${authState.statusRaw})` : "Signed"
    }
    if (authState.display === "pending") {
      if (authState.statusRaw === "declined") return "Declined — action needed on Step 4"
      if (authState.statusRaw) return `Status: ${authState.statusRaw}`
      return "Pending signature"
    }
    return null
  })()

  const resumeComplete = resumeInfo.hasUploadedFile
  const requirementsComplete = step2HasAnyUpload(step2Files)
  const skillComplete =
    skillProgress.total > 0 ? skillProgress.completed === skillProgress.total : false
  const authSigned = authState.display === "signed"
  const identityPairComplete = hasSsnDoc && hasDlDoc
  const authorizationsSectionComplete = authSigned && identityPairComplete
  const referencesComplete = referencesCount >= MIN_COMPLETE_REFERENCES

  const completedSections = [
    resumeComplete,
    requirementsComplete,
    skillComplete,
    authorizationsSectionComplete,
    referencesComplete,
  ].filter(Boolean).length

  const allSectionsReady =
    resumeComplete &&
    requirementsComplete &&
    skillComplete &&
    authorizationsSectionComplete &&
    referencesComplete

  submissionReadinessRef.current = allSectionsReady

  const incompleteSections: { id: string; title: string; href: string }[] = []
  if (!resumeComplete) {
    incompleteSections.push({
      id: "resume",
      title: "Resume",
      href: "/application/step-1-upload",
    })
  }
  if (!requirementsComplete) {
    incompleteSections.push({
      id: "requirements",
      title: "Professional License & Requirements",
      href: "/application/step-2-license",
    })
  }
  if (!skillComplete) {
    incompleteSections.push({
      id: "skills",
      title: "Skill Assessments",
      href: "/application/step-3-assessment",
    })
  }
  if (!authorizationsSectionComplete) {
    incompleteSections.push({
      id: "documents",
      title: "Authorizations & Documents",
      href: "/application/step-4-documents",
    })
  }
  if (!referencesComplete) {
    incompleteSections.push({
      id: "references",
      title: "References",
      href: "/application/step-5-add-references",
    })
  }

  const handleFinalSubmit = () => {
    setSubmitGuardError(null)
    if (!submissionReadinessRef.current) {
      setShowIncompleteWarningModal(true)
      return
    }
    const n = countCompleteReferencesFromStorage()
    setReferencesCount(n)
    if (n < MIN_COMPLETE_REFERENCES) {
      setSubmitGuardError(
        `Add at least ${MIN_COMPLETE_REFERENCES} complete references before submitting. Use Edit on References to return to the previous step.`,
      )
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
      if (countCompleteReferencesFromStorage() < MIN_COMPLETE_REFERENCES) {
        setSuccess(false)
        setLoading(false)
        setSubmitGuardError(
          `Add at least ${MIN_COMPLETE_REFERENCES} complete references before submitting.`,
        )
        return
      }
      localStorage.removeItem("parsedResume")
      localStorage.removeItem("identityDocuments")
      localStorage.removeItem("skillStatus")
      localStorage.removeItem("referencesCount")
      localStorage.removeItem("referenceData")
      localStorage.removeItem("referenceDataDraft")
      router.push("/application/success")
    }, 3000)
  }

  const requirementRows: { key: Step2FileType; file: Step2UploadedFile }[] = STEP2_FILE_TYPES.filter(
    (k) => Boolean(step2Files?.[k]?.name),
  ).map((k) => ({ key: k, file: step2Files![k]! }))

  const authRows: { key: string; title: string; subtitle: string | null; complete: boolean }[] = []
  if (authState.hasActivity) {
    authRows.push({
      key: "auth",
      title: "Authorization agreement",
      subtitle: authAgreementSubtitle,
      complete: authSigned,
    })
  }
  if (hasSsnDoc) {
    authRows.push({
      key: "ssn",
      title: "SSN card",
      subtitle: ssnSubtitle,
      complete: hasSsnDoc,
    })
  }
  if (hasDlDoc) {
    authRows.push({
      key: "dl",
      title: "Driver's license",
      subtitle: dlSubtitle,
      complete: hasDlDoc,
    })
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
        <OnboardingStepper currentStep={6} completedThrough={6} />

        <div className="flex flex-1 flex-col pt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">Summary</h2>
            <span className="text-[12px] font-medium text-slate-500">
              {completedSections} of 5 sections complete
            </span>
          </div>

          <div className="space-y-6">
            {/* Resume — Add Resume step */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-700">Resume uploaded</p>
              <SummaryRow
                title="Resume file"
                subtitle={
                  resumeInfo.hasUploadedFile
                    ? resumeInfo.fileName || "File on file"
                    : "No resume file uploaded yet"
                }
                complete={resumeComplete}
                editHref="/application/step-1-upload"
              />
            </div>

            {/* Requirements — Professional license step */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-700">Requirements</p>
              {requirementRows.length === 0 ? (
                <SummaryRow
                  title="Professional license and requirements"
                  subtitle="No documents uploaded yet"
                  complete={false}
                  editHref="/application/step-2-license"
                />
              ) : (
                <div className="space-y-2">
                  {requirementRows.map(({ key, file }) => (
                    <SummaryRow
                      key={key}
                      title={STEP2_REQUIREMENT_LABELS[key]}
                      subtitle={[file.name, file.size].filter(Boolean).join(" · ") || file.name}
                      complete
                      editHref="/application/step-2-license"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Skill assessment */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-700">Skill assessment</p>
              <SummaryRow
                title="Skill assessments"
                subtitle={skillProgress.label}
                complete={skillComplete}
                editHref="/application/step-3-assessment"
              />
            </div>

            {/* Authorizations & documents */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-700">Authorizations and documents</p>
              {authRows.length === 0 ? (
                <SummaryRow
                  title="Authorizations and identity documents"
                  subtitle="No signed authorization or uploaded identity documents recorded yet"
                  complete={false}
                  editHref="/application/step-4-documents"
                />
              ) : (
                <div className="space-y-2">
                  {authRows.map((row) => (
                    <SummaryRow
                      key={row.key}
                      title={row.title}
                      subtitle={row.subtitle}
                      complete={row.complete}
                      editHref="/application/step-4-documents"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* References */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-slate-700">References</p>
              <SummaryRow
                title={`${referencesCount} of 3 added`}
                subtitle={
                  referencesComplete
                    ? undefined
                    : `At least ${MIN_COMPLETE_REFERENCES} complete references required`
                }
                complete={referencesComplete}
                editHref="/application/step-5-add-references"
              />
            </div>
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
              onClick={() => router.back()}
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
          if (countCompleteReferencesFromStorage() < MIN_COMPLETE_REFERENCES) {
            setSuccess(false)
            setLoading(false)
            setSubmitGuardError(
              `Add at least ${MIN_COMPLETE_REFERENCES} complete references before submitting.`,
            )
            return
          }
          localStorage.removeItem("parsedResume")
          localStorage.removeItem("identityDocuments")
          localStorage.removeItem("skillStatus")
          localStorage.removeItem("referencesCount")
          localStorage.removeItem("referenceData")
          localStorage.removeItem("referenceDataDraft")
          router.push("/application/success")
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
