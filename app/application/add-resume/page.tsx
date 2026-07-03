"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingLoader from "@/app/components/OnboardingLoader"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingShellGradient,
  brandingToCssVars,
  hexToRgba,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
} from "@/lib/tenant/tenant-branding"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon"
import { setScopedApplicantId } from "@/lib/tenant/scoped-storage"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import {
  findResumeUploadStep,
  markResumeUploadStepComplete,
} from "@/lib/onboarding/mark-resume-upload-step-complete"

const APPLICANT_SESSION_TIMEOUT_MS = 15_000
const WORKER_ENSURE_TIMEOUT_MS = 15_000
const RESUME_UPLOAD_TIMEOUT_MS = 45_000
const WORKER_REQUIREMENTS_TIMEOUT_MS = 10_000
const UPLOAD_WATCHDOG_TIMEOUT_MS = 60_000

function timeoutError(message: string) {
  return new Error(message)
}

function promiseWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: number | undefined
  return Promise.race([
    promise.finally(() => {
      if (timer) window.clearTimeout(timer)
    }),
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(timeoutError(message)), ms)
    }),
  ])
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  ms: number,
  message: string,
): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(timeoutError(message)), ms)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw timeoutError(message)
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export default function Step1Upload() {
  const branding = useTenantBranding()
  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: brandingShellGradient(branding),
  }
  const panelSrc = normalizeBrandingImageSrc(branding.loginBackgroundSrc, "/images/handshake.jpg")
  const logoSrc = normalizeBrandingImageSrc(branding.logoUrl, "/images/new-logo-nexus.svg", {
    allowBlob: true,
  })
  const panelUseNativeImg = isRemoteOrBlobImageSrc(panelSrc)
  const logoUseNativeImg = isRemoteOrBlobImageSrc(logoSrc)
  const brandBorderStyle = { borderColor: branding.primaryHex } as CSSProperties
  const brandMutedBgStyle = { backgroundColor: hexToRgba(branding.primaryHex, 0.08) } as CSSProperties
  const brandSoftBgStyle = { backgroundColor: hexToRgba(branding.primaryHex, 0.14) } as CSSProperties
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties
  const brandTextStyle = { color: branding.primaryHex } as CSSProperties
  const secondaryTextStyle = { color: branding.secondaryHex } as CSSProperties

  const ACCEPTED_RESUME_EXTENSIONS = [".pdf", ".doc", ".docx"]

  function isAcceptedResumeFile(selected: File): boolean {
    const lower = selected.name.toLowerCase()
    return ACCEPTED_RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext))
  }

  function validateResumeFile(selected: File): string | null {
    if (!isAcceptedResumeFile(selected)) {
      return "Please upload a resume in PDF, DOC, or DOCX format."
    }
    if (selected.size > 10 * 1024 * 1024) {
      return "Max file size is 10MB."
    }
    return null
  }

  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const onboarding = useOnboardingConfigOptional()

  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadPhase, setUploadPhase] = useState("Uploading resume...")
  const [parseStatus, setParseStatus] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileRequiredError, setFileRequiredError] = useState<string | null>(null)
  const [savedResumeName, setSavedResumeName] = useState("")
  const [savedResumeSizeBytes, setSavedResumeSizeBytes] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    setSavedResumeName(localStorage.getItem("resumeName") || "")
    const sizeRaw = localStorage.getItem("resumeSizeBytes")
    const sizeNum = sizeRaw ? Number(sizeRaw) : null
    setSavedResumeSizeBytes(sizeNum != null && Number.isFinite(sizeNum) ? sizeNum : null)
  }, [])

  useEffect(() => {
    if (file || savedResumeName) {
      setFileRequiredError(null)
    }
  }, [file, savedResumeName])

  useEffect(() => {
    if (!uploading) return
    const timer = window.setTimeout(() => {
      setUploading(false)
      setUploadPhase("Uploading resume...")
      setParseError(
        `Resume upload is taking too long while ${uploadPhase.toLowerCase()}. Please try again.`
      )
    }, UPLOAD_WATCHDOG_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [uploading, uploadPhase])

  function formatBytes(bytes: number | null) {
    if (!bytes && bytes !== 0) return ""
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    const kb = bytes / 1024
    if (kb >= 1) return `${kb.toFixed(0)} KB`
    return `${bytes} B`
  }

  function persistSelectedFile(selected: File) {
    localStorage.setItem("resumeName", selected.name)
    localStorage.setItem("resumeSizeBytes", String(selected.size))
    localStorage.setItem("resumeMimeType", selected.type || "")
    // Clear previous parsing results when choosing a new file.
    localStorage.removeItem("parsedResume")
    localStorage.removeItem("resumeId")
    setSavedResumeName(selected.name)
    setSavedResumeSizeBytes(selected.size)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFileRequiredError(null)
    setParseError(null)
    setParseStatus(null)

    const validationError = validateResumeFile(selected)
    if (validationError) {
      setFileRequiredError(validationError)
      return
    }

    setFile(selected)
    persistSelectedFile(selected)

    // Allows selecting the same file again to retrigger `onChange`.
    e.target.value = ""
  }

  function browse() {
    fileInput.current?.click()
  }

  function drop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return

    setFileRequiredError(null)
    setParseError(null)
    setParseStatus(null)

    const validationError = validateResumeFile(dropped)
    if (validationError) {
      setFileRequiredError(validationError)
      return
    }

    setFile(dropped)
    persistSelectedFile(dropped)
  }

  function dragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function dragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }

  function next() {
    const hasSavedResume =
      typeof window !== "undefined" &&
      Boolean(localStorage.getItem("resumeName")?.trim()) &&
      Boolean(
        localStorage.getItem("parsedResume")?.trim() ||
        localStorage.getItem("resumeStoragePath")?.trim()
      )

    if (!file) {
      if (hasSavedResume) {
        setFileRequiredError(null)
        setParseError(null)
        setParseStatus(null)
        try {
          const raw = localStorage.getItem("parsedResume")?.trim()
          if (raw) {
            let parsed: unknown
            try {
              parsed = JSON.parse(raw) as unknown
            } catch {
              setParseError(RESUME_PARSE_FAILED_USER_MESSAGE)
              localStorage.removeItem("parsedResume")
              return
            }
            const quality = evaluateResumeParseQuality(parsed)
            if (!quality.ok) {
              localStorage.removeItem("parsedResume")
            } else {
              localStorage.setItem(
                "parsedResume",
                JSON.stringify(normalizedResumeToStoredJson(quality.normalized)),
              )
            }
          }
        } catch {
          localStorage.removeItem("parsedResume")
        }
        void (async () => {
          const { ensureApplicantMatchesAuthSession } = await import(
            "@/lib/onboarding/ensure-applicant-auth"
          )
          const { ensureApplicantWorker } = await import("@/lib/onboarding/ensure-applicant-worker")
          const session = await ensureApplicantMatchesAuthSession()
          if ("error" in session) {
            setParseError(session.error)
            return
          }
          setScopedApplicantId(session.applicantId)
          await ensureApplicantWorker(session.applicantId).catch(() => {
            /* best-effort; resume-upload-success will retry */
          })
          try {
            const resumeStep = findResumeUploadStep(onboarding?.config)
            const resumeStepStatus = resumeStep
              ? onboarding?.progress?.steps?.find(
                  (row) => row.onboarding_step_id === resumeStep.id
                )?.status
              : undefined
            await markResumeUploadStepComplete({
              updateStepStatus: onboarding?.updateStepStatus,
              config: onboarding?.config,
              currentStatus: resumeStepStatus,
            })
          } catch {
            /* progress sync is best-effort */
          }
          router.push(applicationPath(APPLICATION_ROUTES.profileReview))
        })()
        return
      }
      setFileRequiredError("Please upload your resume before continuing.")
      return
    }

    ;(async () => {
      setUploading(true)
      setUploadPhase("Preparing applicant session...")
      setParseError(null)
      setParseStatus(null)
      try {
        const { ensureApplicantMatchesAuthSession } = await import(
          "@/lib/onboarding/ensure-applicant-auth"
        )
        const session = await promiseWithTimeout(
          ensureApplicantMatchesAuthSession(),
          APPLICANT_SESSION_TIMEOUT_MS,
          "Applicant session setup timed out. Please refresh and try again.",
        )
        if ("error" in session) {
          throw new Error(session.error)
        }

        setScopedApplicantId(session.applicantId)

        setUploadPhase("Preparing applicant profile...")
        const { ensureApplicantWorker } = await import("@/lib/onboarding/ensure-applicant-worker")
        const workerResult = await promiseWithTimeout(
          ensureApplicantWorker(session.applicantId),
          WORKER_ENSURE_TIMEOUT_MS,
          "Profile setup timed out. Please refresh and try again.",
        )
        if (!workerResult.ok) {
          throw new Error(workerResult.error)
        }

        setUploadPhase("Uploading resume...")
        const fd = new FormData()
        fd.append("file", file)
        fd.append("applicantId", session.applicantId)
        const tenantSlug =
          new URLSearchParams(window.location.search).get("tenant")?.trim().toLowerCase() || ""
        if (tenantSlug) {
          fd.append("tenantSlug", tenantSlug)
        }
        if (workerResult.workerId) {
          fd.append("workerId", workerResult.workerId)
        }
        if (workerResult.tenantId) {
          fd.append("tenantId", workerResult.tenantId)
        }

        const uploadRes = await fetchWithTimeout(
          "/api/upload-resume",
          {
            method: "POST",
            body: fd,
          },
          RESUME_UPLOAD_TIMEOUT_MS,
          "Upload timed out. Please check your connection and try again.",
        )
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to upload resume")
        }
        setUploadPhase("Saving upload details...")
        const uploadJson = (await uploadRes.json()) as {
          fileName?: string
          storagePath?: string
          resumeId?: string | null
          parseStatus?: string
        }

        if (uploadJson.storagePath) {
          localStorage.setItem("resumeStoragePath", uploadJson.storagePath)
          void fetchWithTimeout(
            "/api/onboarding/worker-requirements",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicantId: session.applicantId,
                resume_path: uploadJson.storagePath,
              }),
            },
            WORKER_REQUIREMENTS_TIMEOUT_MS,
            "Resume sync timed out.",
          ).catch(() => {
            // Non-blocking: continue onboarding even if this sync fails.
          })
        }

        if (uploadJson.resumeId) {
          localStorage.setItem("resumeId", uploadJson.resumeId)
        } else {
          localStorage.removeItem("resumeId")
        }

        localStorage.setItem("resumeName", uploadJson?.fileName || file.name)
        localStorage.removeItem("parsedResume")
        localStorage.setItem("step1TermsAccepted", "false")
        localStorage.setItem("step1ReviewCompleted", "false")
        setParseStatus(uploadJson.parseStatus ?? "processing")

        setUploadPhase("Finishing...")
        try {
          const resumeStep = findResumeUploadStep(onboarding?.config)
          const resumeStepStatus = resumeStep
            ? onboarding?.progress?.steps?.find(
                (row) => row.onboarding_step_id === resumeStep.id
              )?.status
            : undefined
          await markResumeUploadStepComplete({
            updateStepStatus: onboarding?.updateStepStatus,
            config: onboarding?.config,
            resumePath: uploadJson.storagePath ?? null,
            currentStatus: resumeStepStatus,
          })
        } catch {
          /* progress sync is best-effort */
        }

        void import("@/lib/onboarding/ensure-applicant-worker").then(({ ensureApplicantWorker }) =>
          ensureApplicantWorker(session.applicantId).catch(() => {
            /* resume-upload-success will retry */
          }),
        )

        router.push(applicationPath(APPLICATION_ROUTES.profileReview))
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to upload resume"
        setParseError(msg)
      } finally {
        setUploading(false)
        setUploadPhase("Uploading resume...")
      }
    })()
  }

  function clearSelectedResume() {
    setFile(null)
    setSavedResumeName("")
    setSavedResumeSizeBytes(null)
    setFileRequiredError(null)
    setParseError(null)
    setParseStatus(null)
    localStorage.removeItem("resumeName")
    localStorage.removeItem("resumeSizeBytes")
    localStorage.removeItem("resumeMimeType")
    localStorage.removeItem("resumeStoragePath")
    localStorage.removeItem("parsedResume")
    localStorage.removeItem("resumeId")
    localStorage.setItem("step1TermsAccepted", "false")
    localStorage.setItem("step1ReviewCompleted", "false")
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center p-4 md:p-8"
      style={shellStyle}
    >

      <div
        className={`bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex overflow-hidden min-h-[540px] transition-opacity ${uploading ? "opacity-50" : "opacity-100"}`}
      >

        <div className="w-full md:w-2/3 p-8 md:p-10">

          <OnboardingStepper />

          <h2 className="text-2xl font-semibold text-gray-800 mt-6 mb-6">
            Upload your resume
          </h2>

          <div
            onDrop={drop}
            onDragOver={dragOver}
            onDragLeave={dragLeave}
            role="button"
            tabIndex={0}
            onClick={browse}
            className="cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition"
            style={
              dragActive
                ? { ...brandBorderStyle, ...brandMutedBgStyle }
                : brandBorderStyle
            }
          >

            {file || savedResumeName ? (
              <div
                className="mx-auto flex max-w-[540px] items-center justify-between gap-3 rounded-lg border px-4 py-3"
                style={{
                  borderColor: hexToRgba(branding.primaryHex, 0.35),
                  backgroundColor: hexToRgba(branding.primaryHex, 0.1),
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-md"
                    style={brandSoftBgStyle}
                  >
                    <BrandedSvgIcon
                      src="/icons/pdf-icon.svg"
                      className="h-6 w-6"
                      color={branding.primaryHex}
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="truncate font-semibold" style={secondaryTextStyle}>
                      {file?.name || savedResumeName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatBytes(file ? file.size : savedResumeSizeBytes)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearSelectedResume()
                  }}
                  className="cursor-pointer rounded-md p-1 transition hover:bg-[color:var(--brand-primary)]/10"
                  aria-label="Remove uploaded resume"
                >
                  <BrandedSvgIcon
                    src="/icons/delete-icon.svg"
                    className="h-7 w-7"
                    color={branding.primaryHex}
                  />
                </button>
              </div>
            ) : (
              <>
                <div className="mx-auto mb-4 flex items-center justify-center">
                  <BrandedUploadIcon className="h-14 w-14" primaryHex={branding.primaryHex} />
                </div>

                <p className="text-black mb-4">
                  Drag your file(s) to start uploading
                </p>

                <div className="text-xs text-[#6D6D6D] mb-2">OR</div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    browse()
                  }}
                  className="cursor-pointer rounded-md border px-6 py-2 text-sm transition hover:opacity-90"
                  style={{ ...brandBorderStyle, ...brandTextStyle }}
                >
                  Browse files
                </button>

                <p className="text-xs text-[#6B7280] mt-3">
                  Max 10 MB files are allowed
                </p>
              </>
            )}

            <input
              type="file"
              accept=".pdf,.doc,.docx"
              ref={fileInput}
              className="hidden"
              onChange={handleFile}
            />
          </div>

          <div className="mt-3 text-xs text-[#6D6D6D]">
            Accepted formats: PDF, DOC, and DOCX (max 10 MB)
          </div>

          {fileRequiredError ? (
            <div className="mt-3 text-sm text-rose-600">
              {fileRequiredError}
            </div>
          ) : null}

          {parseError ? (
            <div
              role="alert"
              className="mt-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3"
            >
              <p className="font-medium">{parseError}</p>
            </div>
          ) : null}

          {parseStatus === "processing" ? (
            <p className="mt-3 text-sm text-slate-600">
              Resume uploaded. Profile details will be filled in automatically when parsing finishes.
            </p>
          ) : null}

          <div className="flex justify-end gap-4 mt-10">
            <button
              onClick={() => router.back()}
              className="cursor-pointer rounded-lg border px-6 py-2 text-sm hover:bg-gray-50"
              style={{ ...brandBorderStyle, ...brandTextStyle }}
            >
              Cancel
            </button>

            <button
              onClick={next}
              disabled={uploading}
              className={`cursor-pointer rounded-lg px-8 py-2 text-sm text-white transition hover:brightness-90 ${uploading ? "cursor-not-allowed opacity-70" : ""}`}
              style={primaryBtnStyle}
            >
              {uploading ? "Uploading..." : "Next"}
            </button>
          </div>

        </div>

        <div className="relative hidden w-1/3 md:block">
          {panelUseNativeImg ? (
            <img
              src={panelSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale"
            />
          ) : (
            <Image
              src={panelSrc}
              alt=""
              fill
              sizes="(max-width: 767px) 0px, 33vw"
              className="object-cover grayscale opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-white/65" />
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="flex w-full max-w-[270px] flex-col items-center gap-6">
              <div className="relative flex h-[60px] min-h-[60px] w-[204px] max-w-full items-center justify-center">
                {logoUseNativeImg ? (
                  <img
                    src={logoSrc}
                    alt={branding.companyName}
                    className="max-h-[60px] max-w-full object-contain"
                  />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={branding.companyName}
                    width={204}
                    height={60}
                    className="max-h-[60px] max-w-full object-contain"
                    priority
                  />
                )}
              </div>
              <div className="flex w-full items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-400/55" />
                <BrandedSvgIcon
                  src="/icons/circle-star-icon.svg"
                  className="h-6 w-6 flex-none"
                  color={branding.primaryHex}
                />
                <div className="h-px flex-1 bg-slate-400/55" />
              </div>
              <p className="text-center text-[16px] font-normal leading-6 tracking-normal text-black">
                {branding.tagline}
              </p>
            </div>
          </div>
        </div>

      </div>

      {uploading ? (
        <OnboardingLoader overlay label={uploadPhase} />
      ) : null}
    </div>
  )
}
