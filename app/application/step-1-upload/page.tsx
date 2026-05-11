"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingLoader from "@/app/components/OnboardingLoader"
import {
  evaluateResumeParseQuality,
  normalizedResumeToStoredJson,
  RESUME_PARSE_FAILED_USER_MESSAGE,
} from "@/lib/resumeParseQuality"


export default function Step1Upload() {

  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseMissingFields, setParseMissingFields] = useState<string[]>([])
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
    setSavedResumeName(selected.name)
    setSavedResumeSizeBytes(selected.size)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFileRequiredError(null)
    setParseError(null)
    setParseMissingFields([])

    // ✅ SIZE VALIDATION
    if (selected.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB")
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
    setParseMissingFields([])

    if (dropped.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB")
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
        setParseMissingFields([])
        try {
          const raw = localStorage.getItem("parsedResume")?.trim()
          if (raw) {
            let parsed: unknown
            try {
              parsed = JSON.parse(raw) as unknown
            } catch {
              setParseError(RESUME_PARSE_FAILED_USER_MESSAGE)
              setParseMissingFields([])
              localStorage.removeItem("parsedResume")
              return
            }
            const quality = evaluateResumeParseQuality(parsed)
            if (!quality.ok) {
              setParseError(quality.message)
              setParseMissingFields(quality.missingFieldLabels)
              localStorage.removeItem("parsedResume")
              return
            }
            localStorage.setItem(
              "parsedResume",
              JSON.stringify(normalizedResumeToStoredJson(quality.normalized)),
            )
          }
        } catch {
          setParseError(RESUME_PARSE_FAILED_USER_MESSAGE)
          setParseMissingFields([])
          localStorage.removeItem("parsedResume")
          return
        }
        router.push("/application/step-1-success")
        return
      }
      setFileRequiredError("Please upload your resume *")
      return
    }

    ;(async () => {
      setParsing(true)
      setParseError(null)
      setParseMissingFields([])
      try {
        // 1) Extract text from the uploaded PDF
        const fd = new FormData()
        fd.append("file", file)
        const applicantId =
          typeof window !== "undefined"
            ? localStorage.getItem("applicantId")
            : null
        if (applicantId) {
          fd.append("applicantId", applicantId)
        }
        const uploadRes = await fetch("/api/upload-resume", {
          method: "POST",
          body: fd,
        })
        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to read resume")
        }
        const uploadJson = (await uploadRes.json()) as {
          text: string
          fileName?: string
          storagePath?: string
        }
        const text = uploadJson?.text
        if (uploadJson.storagePath) {
          localStorage.setItem("resumeStoragePath", uploadJson.storagePath)
          if (applicantId) {
            await fetch("/api/onboarding/worker-requirements", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicantId,
                resume_path: uploadJson.storagePath,
              }),
            }).catch(() => {
              // Non-blocking: continue onboarding even if this sync fails.
            })
          }
        }
        if (!text || typeof text !== "string" || !text.trim()) {
          throw new Error("Could not extract text from the resume file")
        }

        // 2) Convert extracted text into structured JSON
        const processRes = await fetch("/api/process-resume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        })
        if (processRes.status === 422) {
          const data = (await processRes.json().catch(() => ({}))) as {
            error?: string
            missingFields?: string[]
          }
          setParseError(data?.error || RESUME_PARSE_FAILED_USER_MESSAGE)
          setParseMissingFields(Array.isArray(data?.missingFields) ? data.missingFields : [])
          return
        }
        if (!processRes.ok) {
          const data = await processRes.json().catch(() => ({}))
          throw new Error(data?.error || "Failed to parse resume")
        }
        const parsed = await processRes.json()
        const quality = evaluateResumeParseQuality(parsed)
        if (!quality.ok) {
          setParseError(quality.message)
          setParseMissingFields(quality.missingFieldLabels)
          return
        }

        localStorage.setItem(
          "parsedResume",
          JSON.stringify(normalizedResumeToStoredJson(quality.normalized)),
        )
        localStorage.setItem("resumeName", uploadJson?.fileName || file.name)
        localStorage.setItem("step1TermsAccepted", "false")
        localStorage.setItem("step1ReviewCompleted", "false")
        router.push("/application/step-1-success")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to parse resume"
        setParseError(msg)
        setFile((prev) => prev) // keep selection
      } finally {
        setParsing(false)
      }
    })()
  }

  function clearSelectedResume() {
    setFile(null)
    setSavedResumeName("")
    setSavedResumeSizeBytes(null)
    setFileRequiredError(null)
    setParseError(null)
    setParseMissingFields([])
    localStorage.removeItem("resumeName")
    localStorage.removeItem("resumeSizeBytes")
    localStorage.removeItem("resumeMimeType")
    localStorage.removeItem("resumeStoragePath")
    localStorage.removeItem("parsedResume")
    localStorage.setItem("step1TermsAccepted", "false")
    localStorage.setItem("step1ReviewCompleted", "false")
  }

  return (
    <div className="relative min-h-screen bg-[linear-gradient(135deg,#19c7c0_0%,#10a58f_100%)] flex items-center justify-center p-4 md:p-8">

      <div
        className={`bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex overflow-hidden min-h-[540px] transition-opacity ${parsing ? "opacity-50" : "opacity-100"}`}
      >

        <div className="w-full md:w-2/3 p-8 md:p-10">

          <OnboardingStepper currentStep={1} />

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
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${dragActive ? "border-[#0D9488] bg-teal-50" : "border-[#0D9488]"
              }`}
          >

            {file || savedResumeName ? (
              <div className="mx-auto flex max-w-[540px] items-center justify-between gap-3 rounded-lg border border-[#9fded8] bg-[#ecfffd] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#dff7f3]">
                    <Image
                      src="/icons/pdf-icon.svg"
                      alt="PDF"
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                  </div>
                  <div className="min-w-0 text-left">
                    <div className="truncate text-teal-700 font-semibold">
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
                  className="cursor-pointer p-1"
                  aria-label="Remove uploaded resume"
                >
                  <Image
                    src="/icons/delete-icon.svg"
                    alt="Delete"
                    width={28}
                    height={28}
                    className="h-7 w-7"
                  />
                </button>
              </div>
            ) : (
              <>
                <div className="mx-auto mb-4 flex items-center justify-center">
                  <Image src="/images/upload.svg" alt="Upload" width={56} height={56} />
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
                  className="cursor-pointer border border-[#0D9488] text-[#0D9488] px-6 py-2 rounded-md text-sm hover:bg-teal-50"
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
            Only support .docx or pdf files
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
              {parseMissingFields.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-rose-800/90">
                  {parseMissingFields.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-4 mt-10">
            <button
              onClick={() => router.back()}
              className="cursor-pointer border px-6 py-2 rounded-lg text-[#0D9488] text-sm hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              onClick={next}
              disabled={parsing}
              className={`cursor-pointer bg-[#0D9488] hover:bg-teal-800 text-white px-8 py-2 rounded-lg text-sm transition ${parsing ? "opacity-70 cursor-not-allowed hover:bg-teal-700" : ""
                }`}
            >
              {parsing ? "Parsing..." : "Next"}
            </button>
          </div>

        </div>

        <div className="hidden md:block w-1/3 relative">
          <Image
            src="/images/nurse.jpg"
            alt="nurse"
            fill
            sizes="(max-width: 767px) 0px, 33vw"
            className="object-cover grayscale opacity-60"
          />
          <div className="absolute inset-0 bg-white/65" />
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <div className="flex flex-col items-center">
              <Image
                src="/images/new-logo-nexus.svg"
                alt="Nexus MedPro Logo"
                width={220}
                height={80}
                className="w-56 h-auto"
                priority
              />
              <div className="mt-6 flex items-center justify-center w-56">
                <div className="flex-1 h-px bg-[#94A3B8]" />
                <Image
                  src="/images/tabler_circle-asterisk.svg"
                  alt="divider icon"
                  width={24}
                  height={24}
                  className="mx-2"
                />
                <div className="flex-1 h-px bg-[#94A3B8]" />
              </div>
              <div className="mt-4 text-sm text-black text-center leading-snug">
                Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
              </div>
            </div>
          </div>
        </div>

      </div>

      {parsing ? (
        <OnboardingLoader
          overlay
          label="Resume parsing..."
          backgroundClassName="bg-[linear-gradient(135deg,#19c7c0_0%,#10a58f_100%)]"
        />
      ) : null}
    </div>
  )
}
