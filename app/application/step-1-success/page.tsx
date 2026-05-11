"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"

export default function Step1Success() {
  const router = useRouter()

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
  const [parseQualityFailed, setParseQualityFailed] = useState(false)
  const [parseQualityMessage, setParseQualityMessage] = useState<string | null>(null)
  const [parseMissingFields, setParseMissingFields] = useState<string[]>([])

  const resumeQuality = useMemo(() => {
    if (typeof window === "undefined") return "pending" as const
    const raw = localStorage.getItem("parsedResume")?.trim()
    if (!raw) return "no_resume_json" as const
    try {
      return evaluateResumeParseQuality(JSON.parse(raw) as unknown)
    } catch {
      return {
        ok: false as const,
        parseStatus: "Parse Failed" as const,
        message: RESUME_PARSE_FAILED_USER_MESSAGE,
        missingFieldLabels: [] as string[],
      }
    }
  }, [])

  useEffect(() => {
    if (resumeQuality === "pending") return
    if (resumeQuality === "no_resume_json") {
      setParseQualityFailed(false)
      setParseQualityMessage(null)
      setParseMissingFields([])
      return
    }
    if (resumeQuality.ok) {
      setParseQualityFailed(false)
      setParseQualityMessage(null)
      setParseMissingFields([])
      return
    }
    setParseQualityFailed(true)
    setParseQualityMessage(resumeQuality.message)
    setParseMissingFields(resumeQuality.missingFieldLabels)
    localStorage.removeItem("parsedResume")
  }, [resumeQuality])

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

    router.push("/application/step-1-upload")
  }

  function handleContinue() {
    if (parseQualityFailed) {
      return
    }
    const raw = typeof window !== "undefined" ? localStorage.getItem("parsedResume")?.trim() : ""
    if (raw) {
      try {
        const q = evaluateResumeParseQuality(JSON.parse(raw) as unknown)
        if (!q.ok) {
          setParseQualityFailed(true)
          setParseQualityMessage(q.message)
          setParseMissingFields(q.missingFieldLabels)
          localStorage.removeItem("parsedResume")
          return
        }
        localStorage.setItem("parsedResume", JSON.stringify(normalizedResumeToStoredJson(q.normalized)))
      } catch {
        setParseQualityFailed(true)
        setParseQualityMessage(RESUME_PARSE_FAILED_USER_MESSAGE)
        setParseMissingFields([])
        localStorage.removeItem("parsedResume")
        return
      }
    }
    if (!agree) {
      setTermsRequiredError("Please accept Terms & Conditions *")
      return
    }
    router.push("/application/step-1-review")
  }

  return (
    <OnboardingLayout>
      <div className="flex h-full flex-col">
        <div className="px-6 pt-6 sm:px-8 sm:pt-8 md:px-10 md:pt-8">
          <OnboardingStepper
            currentStep={1}
            title="Resume Uploaded"
            // titleIconSrc="/icons/yes-sign-icon.svg"
            titleIconAlt="Resume uploaded"
          />
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-2 sm:px-8 md:px-10">
          {parseQualityFailed ? (
            <div
              role="alert"
              className="mt-6 flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-rose-900"
            >
              <p className="text-[14px] font-semibold leading-6">
                {parseQualityMessage || RESUME_PARSE_FAILED_USER_MESSAGE}
              </p>
              {parseMissingFields.length > 0 ? (
                <ul className="list-disc pl-5 text-[13px] leading-snug text-rose-800/95">
                  {parseMissingFields.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-[13px] text-rose-800/90">
                Upload a clearer resume from the previous step, or continue after the file is replaced.
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-[#1db4a3] bg-[#ecfbf9] px-4 py-4 text-[#0f766e]">
              <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full  text-white">
                <Image
                  src="/icons/yes-sign-icon.svg"
                  alt="Success"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
              <p className="text-[14px] leading-6">
                Resume parsed successfully. Carefully review your information before submitting the
                application.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between rounded-lg border border-[#1db4a3] bg-[#f3fffd] px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#dff7f3]">
                <Image
                  src="/icons/pdf-icon.svg"
                  alt="PDF"
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>

              <div>
                <p className="text-[14px] font-semibold text-[#0f766e]">
                  {fileName}
                </p>
                <p className="text-xs text-gray-400">{formatBytes(fileSizeBytes)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={removeFile}
              className="cursor-pointer inline-flex h-10 w-10 items-center justify-center rounded-md text-[#0f766e] transition hover:bg-teal-50"
              aria-label="Remove file"
            >
              <Image
                src="/icons/delete-icon.svg"
                alt="Delete"
                width={24}
                height={24}
                className="h-6 w-6"
              />
            </button>
          </div>

          {!termsCheckboxVisible ? (
            <p className="mt-6 text-[14px] leading-6 text-slate-700">
              Open the{" "}
              <Link href="/application/terms-and-conditions" className="font-semibold text-teal-600 underline">
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
                  <Link href="/application/terms-and-conditions" className="font-semibold text-teal-600 underline">
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
              disabled={!agree || parseQualityFailed}
              className="cursor-pointer inline-flex h-11 items-center justify-center rounded-lg bg-[#1db4a3] px-10 text-[16px] font-semibold text-white transition hover:bg-[#169b8c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
