"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { hexToRgba } from "@/lib/tenant/tenant-branding"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import { findResumeUploadStep, markResumeUploadStepComplete } from "@/lib/onboarding/mark-resume-upload-step-complete"
import { ensureApplicantWorker } from "@/lib/onboarding/ensure-applicant-worker"
import { useResumeParsePoll } from "@/lib/resume/use-resume-parse-poll"

export default function Step1Success() {
  const branding = useTenantBranding()
  const router = useRouter()
  const onboarding = useOnboardingConfigOptional()
  const brandSurfaceStyle = {
    borderColor: branding.primaryHex,
    backgroundColor: hexToRgba(branding.primaryHex, 0.1),
    color: branding.secondaryHex,
  }
  const fileCardStyle = {
    borderColor: branding.primaryHex,
    backgroundColor: hexToRgba(branding.primaryHex, 0.08),
  }
  const fileIconBgStyle = { backgroundColor: hexToRgba(branding.primaryHex, 0.14) }
  const primaryBtnStyle = { backgroundColor: branding.primaryHex }
  const linkStyle = { color: branding.primaryHex }

  const [fileName] = useState<string>(() => {
    if (typeof window === "undefined") return "resume.pdf"
    return localStorage.getItem("resumeName") || "resume.pdf"
  })
  const [fileSizeBytes] = useState<number | null>(() => {
    if (typeof window === "undefined") return null
    const sizeRaw = localStorage.getItem("resumeSizeBytes")
    const sizeNum = sizeRaw ? Number(sizeRaw) : null
    return sizeNum != null && Number.isFinite(sizeNum) ? sizeNum : null
  })
  const [agree, setAgree] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("step1TermsAccepted") === "true"
  })
  const [termsCheckboxVisible, setTermsCheckboxVisible] = useState(() => {
    if (typeof window === "undefined") return false
    return (
      localStorage.getItem("step1TermsAccepted") === "true" ||
      localStorage.getItem("step1TermsOpened") === "true"
    )
  })
  const [termsRequiredError, setTermsRequiredError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)
  const [resumeId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem("resumeId")?.trim() || null
  })

  const parsePoll = useResumeParsePoll(resumeId)
  const parseStatus = parsePoll.status
  const isParsing = parseStatus === "processing" || parseStatus === "pending" || parsePoll.isPolling

  useEffect(() => {
    if (typeof window === "undefined") return
    const refreshAgreeState = () => {
      setAgree(localStorage.getItem("step1TermsAccepted") === "true")
      setTermsCheckboxVisible(
        localStorage.getItem("step1TermsAccepted") === "true" ||
          localStorage.getItem("step1TermsOpened") === "true",
      )
    }
    window.addEventListener("focus", refreshAgreeState)
    window.addEventListener("storage", refreshAgreeState)
    refreshAgreeState()
    return () => {
      window.removeEventListener("focus", refreshAgreeState)
      window.removeEventListener("storage", refreshAgreeState)
    }
  }, [])

  function formatBytes(bytes: number | null) {
    if (!bytes && bytes !== 0) return "—"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    const kb = bytes / 1024
    if (kb >= 1) return `${kb.toFixed(0)} KB`
    return `${bytes} B`
  }

  // ✅ REMOVE FILE
  const removeFile = () => {
    localStorage.removeItem("resumeName")
    localStorage.removeItem("resumeFile")
    localStorage.removeItem("parsedResume")
    localStorage.removeItem("resumeStoragePath")
    localStorage.removeItem("resumeSizeBytes")
    localStorage.removeItem("resumeId")

    router.push(applicationPath(APPLICATION_ROUTES.addResume))
  }

  function handleContinue() {
    if (continuing) {
      return
    }
    const raw = typeof window !== "undefined" ? localStorage.getItem("parsedResume")?.trim() : ""
    if (raw) {
      try {
        const q = evaluateResumeParseQuality(JSON.parse(raw) as unknown)
        if (q.ok) {
          localStorage.setItem("parsedResume", JSON.stringify(normalizedResumeToStoredJson(q.normalized)))
        }
      } catch {
        localStorage.removeItem("parsedResume")
      }
    }
    if (!agree) {
      setTermsRequiredError("Please accept Terms & Conditions *")
      return
    }

    void (async () => {
      setSaveError(null)
      setContinuing(true)
      try {
        const ensured = await ensureApplicantWorker()
        if (!ensured.ok) {
          setSaveError(ensured.error)
          return
        }

        localStorage.setItem("step1ReviewCompleted", "true")

        const resumeStep = findResumeUploadStep(onboarding?.config)

        try {
          const resumeStepStatus = resumeStep
            ? onboarding?.progress?.steps?.find(
                (row) => row.onboarding_step_id === resumeStep.id
              )?.status
            : undefined
          await markResumeUploadStepComplete({
            updateStepStatus: onboarding?.updateStepStatus,
            config: onboarding?.config,
            resumePath: localStorage.getItem("resumeStoragePath")?.trim() || null,
            currentStatus: resumeStepStatus,
          })
        } catch {
          /* progress is best-effort */
        }

        const next = applicationPath(APPLICATION_ROUTES.profileReview)
        router.push(next)
      } finally {
        setContinuing(false)
      }
    })()
  }

  return (
    <OnboardingLayout>
      <div className="flex h-full flex-col">
        <div className="px-6 pt-6 sm:px-8 sm:pt-8 md:px-10 md:pt-8">
          <OnboardingStepper
            title="Resume Uploaded"
            // titleIconSrc="/icons/yes-sign-icon.svg"
            titleIconAlt="Resume uploaded"
          />
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-2 sm:px-8 md:px-10">
          {isParsing ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-slate-800">
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full">
                <BrandedSvgIcon
                  src="/icons/circle-star-icon.svg"
                  className="h-6 w-6 animate-pulse"
                  color={branding.primaryHex}
                />
              </div>
              <p className="text-[14px] leading-6">
                Resume uploaded. We&apos;re extracting your profile details in the background — you can
                continue now and review or enter them manually on the next step.
              </p>
            </div>
          ) : parseStatus === "failed" ? (
            <div
              role="alert"
              className="mt-6 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950"
            >
              <p className="text-[14px] font-semibold leading-6">
                {parsePoll.parseError || RESUME_PARSE_FAILED_USER_MESSAGE}
              </p>
              <p className="text-[13px] text-amber-900/90">
                Your resume is saved. Continue and fill in your profile manually — no need to re-upload.
              </p>
            </div>
          ) : parsePoll.parsedResume ? (
            <div className="mt-6 flex items-start gap-3 rounded-lg border px-4 py-4" style={brandSurfaceStyle}>
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full">
                <BrandedSvgIcon
                  src="/icons/yes-sign-icon.svg"
                  className="h-6 w-6"
                  color={branding.primaryHex}
                />
              </div>
              <p className="text-[14px] leading-6">
                Resume parsed successfully. Carefully review your information before submitting the
                application.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-lg border px-4 py-4" style={brandSurfaceStyle}>
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full">
                <BrandedSvgIcon
                  src="/icons/yes-sign-icon.svg"
                  className="h-6 w-6"
                  color={branding.primaryHex}
                />
              </div>
              <p className="text-[14px] leading-6">
                Resume uploaded. You can continue and enter your profile details on the next step.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between rounded-lg border px-5 py-4" style={fileCardStyle}>
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-md"
                style={fileIconBgStyle}
              >
                <BrandedSvgIcon
                  src="/icons/pdf-icon.svg"
                  className="h-6 w-6"
                  color={branding.primaryHex}
                />
              </div>

              <div>
                <p className="text-[14px] font-semibold" style={{ color: branding.secondaryHex }}>
                  {fileName}
                </p>
                <p className="text-xs text-gray-400">{formatBytes(fileSizeBytes)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              className="cursor-pointer inline-flex h-10 w-10 items-center justify-center rounded-md transition hover:opacity-80"
              style={{ color: branding.secondaryHex }}
              aria-label="Remove file"
            >
              <BrandedSvgIcon
                src="/icons/delete-icon.svg"
                className="h-6 w-6"
                color={branding.primaryHex}
              />
            </button>
          </div>

          {!termsCheckboxVisible ? (
            <p className="mt-6 text-[14px] leading-6 text-slate-700">
              Open the{" "}
              <Link
                href={applicationPath("/application/terms-and-conditions")}
                className="font-semibold underline"
                style={linkStyle}
              >
                Terms & Conditions
              </Link>{" "}
              to review them; the acceptance option will appear after you have reached the end of the document.
            </p>
          ) : (
            <div className="mt-6">
              <OnboardingCheckbox
                checked={agree}
                onChange={(next) => {
                  setAgree(next)
                  if (typeof window !== "undefined") {
                    if (next) localStorage.setItem("step1TermsAccepted", "true")
                    else localStorage.removeItem("step1TermsAccepted")
                  }
                }}
                className="text-sm text-slate-700"
              >
                <span className="text-[14px] leading-6">
                  I accept the{" "}
                  <Link
                href={applicationPath("/application/terms-and-conditions")}
                className="font-semibold underline"
                style={linkStyle}
              >
                    Terms & Conditions
                  </Link>
                </span>
              </OnboardingCheckbox>
            </div>
          )}

          {termsRequiredError ? (
            <div className="mt-2 text-sm text-rose-600" aria-live="polite">
              {termsRequiredError}
            </div>
          ) : null}

          {saveError ? (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
            >
              {saveError}
            </div>
          ) : null}

          <div className="mt-auto flex justify-end gap-4 pt-10">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 px-8 text-[16px] font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={!agree || continuing}
              className="cursor-pointer inline-flex h-11 items-center justify-center rounded-lg px-10 text-[16px] font-semibold text-white transition hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={primaryBtnStyle}
            >
              {continuing ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
