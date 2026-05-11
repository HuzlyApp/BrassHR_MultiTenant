"use client"

import Image from "next/image"
import { Check } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

interface Props {
  currentStep: number
  completedThrough?: number
  title?: string
  titleIconSrc?: string
  titleIconAlt?: string
}

export default function OnboardingStepper({
  currentStep,
  completedThrough,
  title,
  titleIconSrc,
  titleIconAlt
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const steps = [
    "Add Resume",
    "Professional\nLicense",
    "Skill\nAssessment",
    "Authorizations\n& Documents",
    "Add References",
    "Summary"
  ]
  const stepRoutes = [
    "/application/step-1-upload",
    "/application/step-2-license",
    "/application/step-3-skills",
    "/application/step-4-documents",
    "/application/step-5-add-references",
    "/application/step-6-summary",
  ]

  const requestedStep = useMemo(() => {
    const p = pathname || ""
    if (p.includes("/application/step-6-summary")) return 6
    if (p.includes("/application/step-5-")) return 5
    if (
      p.includes("/application/step-4-") ||
      p.includes("/application/employee-agreement") ||
      p.includes("/application/upload-form") ||
      p.includes("/application/upload-19-form")
    ) return 4
    if (p.includes("/application/step-3-")) return 3
    if (p.includes("/application/step-2-")) return 2
    if (p.includes("/application/step-1-")) return 1
    return 1
  }, [pathname])

  const [maxAllowedStep, setMaxAllowedStep] = useState<number>(1)

  useEffect(() => {
    if (typeof window === "undefined") return

    const hasResume = Boolean(
      localStorage.getItem("resumeName")?.trim() ||
      localStorage.getItem("parsedResume")?.trim() ||
      localStorage.getItem("resumeStoragePath")?.trim()
    )
    const step1ReviewCompletedFlag = localStorage.getItem("step1ReviewCompleted") === "true"
    const step2FilesRaw = localStorage.getItem("step2_files")
    let hasStep2Files = false
    if (step2FilesRaw?.trim()) {
      try {
        const parsed = JSON.parse(step2FilesRaw)
        hasStep2Files = Array.isArray(parsed) ? parsed.length > 0 : true
      } catch {
        hasStep2Files = true
      }
    }
    const step4Done =
      localStorage.getItem("step4Skipped") === "1" ||
      localStorage.getItem("step4AuthorizationAgreed") === "true"
    const step5Done = localStorage.getItem("step5Completed") === "true"
    const step1ReviewCompleted = step1ReviewCompletedFlag || hasStep2Files

    let allowedStep = 1
    let redirectPath = "/application/step-1-upload"
    if (hasResume) {
      allowedStep = 2
      redirectPath = "/application/step-1-review"
    }
    if (hasResume && step1ReviewCompleted) {
      allowedStep = 3
      redirectPath = "/application/step-2-license"
    }
    if (hasResume && step1ReviewCompleted && hasStep2Files) {
      allowedStep = 4
      redirectPath = "/application/step-3-skills"
    }
    if (hasResume && step1ReviewCompleted && hasStep2Files && step4Done) {
      allowedStep = 5
      redirectPath = "/application/step-4-documents"
    }
    if (hasResume && step1ReviewCompleted && hasStep2Files && step4Done && step5Done) {
      allowedStep = 6
      redirectPath = "/application/step-5-add-references"
    }

    setMaxAllowedStep(allowedStep)
    if (requestedStep > allowedStep) {
      router.replace(redirectPath)
    }
  }, [requestedStep, router])

  const progress =
    currentStep === steps.length
      ? ((steps.length - 2) / (steps.length - 1)) * 100
      : ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <>
      <div className="w-full border-b border-slate-200 pb-6">
        <div className="relative mx-auto mt-2 w-full max-w-3xl px-2">
          {/* Background line */}
          <div className="absolute left-10 right-10 top-3 h-[2px] bg-[#f1f5f9]" />

          {/* Progress line */}
          <div
            className="absolute left-10 top-3 h-[2px] bg-[#1db4a3] transition-all"
            style={{ width: `${progress}%` }}
          />

          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const stepNumber = index + 1
              const completed =
                stepNumber <= (completedThrough ?? currentStep - 1)
              const active = stepNumber === currentStep
              const maxAccessibleStep = Math.min(completedThrough ?? currentStep, maxAllowedStep)
              const isClickable = stepNumber <= maxAccessibleStep

              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => {
                    if (!isClickable) return
                    router.push(stepRoutes[index])
                  }}
                  disabled={!isClickable}
                  className={`group flex w-24 flex-col items-center rounded-lg px-1.5 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1db4a3]/40 ${
                    isClickable ? "cursor-pointer" : "cursor-not-allowed"
                  }`}
                  aria-label={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}`}
                  title={`${isClickable ? "Go to" : "Locked"} ${step.replace("\n", " ")}`}
                >
                  <div
                    className={`
                      z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full text-sm font-semibold transition-colors
                      ${
                        completed
                          ? "bg-[#1db4a3] text-white outline outline-[4px] outline-white"
                          : active
                            ? "bg-white border-[3px] border-[#1db4a3] outline outline-[4px] outline-white"
                            : "bg-white border-[3px] border-[#f1f5f9] outline outline-[4px] outline-white"
                      }
                    `}
                  >
                    {completed ? (
                      <Check size={14} strokeWidth={3} />
                    ) : active ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#1db4a3]" />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full bg-[#e2e8f0]" />
                    )}
                  </div>

                  <span
                    className={`mt-3 whitespace-pre-line text-[12px] leading-tight
                      ${
                        active || completed
                          ? "text-[#1db4a3] font-medium"
                          : "text-gray-400"
                      }
                    ${isClickable ? "group-hover:text-[#1db4a3] group-hover:underline" : ""}`}
                  >
                    {step}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {title ? (
        <div className="mt-8 flex items-center gap-3">
          {titleIconSrc ? (
            <Image
              src={titleIconSrc}
              alt={titleIconAlt ?? ""}
              width={24}
              height={24}
              className="h-6 w-6"
            />
          ) : null}
          <div className="text-[24px] font-semibold leading-8 text-slate-800">
            {title}
          </div>
        </div>
      ) : null}
    </>
  )
}