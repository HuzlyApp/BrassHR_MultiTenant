"use client"

import type { CSSProperties } from "react"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { resolveApplicantId } from "@/lib/onboarding/upload-required-file-client"
import { brandingToCssVars, hexToRgba } from "@/lib/tenant/tenant-branding"

type UploadedFileMeta = {
  name: string
  sizeLabel: string
}

const I9_FILE_KEY = "employeeAgreementI9File"
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatFileSize(bytes: number) {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) {
    return `${mb.toFixed(2)}MB`
  }

  const kb = bytes / 1024
  return `${kb.toFixed(0)}KB`
}

function isAllowedFile(file: File) {
  const lowerName = file.name.toLowerCase()
  return lowerName.endsWith(".pdf") || lowerName.endsWith(".docx")
}

export default function Upload19FormPage() {
  const branding = useTenantBranding()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [storedFileMeta, setStoredFileMeta] = useState<UploadedFileMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const contentStyle = brandingToCssVars(branding) as CSSProperties
  const completedSurfaceStyle = {
    borderColor: branding.primaryHex,
    backgroundColor: hexToRgba(branding.primaryHex, 0.08),
  } as CSSProperties
  const dragActiveStyle = {
    borderColor: branding.primaryHex,
    backgroundColor: hexToRgba(branding.primaryHex, 0.06),
  } as CSSProperties
  const brandSoftBgStyle = { backgroundColor: hexToRgba(branding.primaryHex, 0.06) } as CSSProperties
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  useEffect(() => {
    const storedFile = localStorage.getItem(I9_FILE_KEY)
    if (!storedFile) return

    try {
      const parsed = JSON.parse(storedFile) as UploadedFileMeta
      if (parsed?.name && parsed?.sizeLabel) {
        setStoredFileMeta(parsed)
        setError(null)
      }
    } catch {
      localStorage.removeItem(I9_FILE_KEY)
    }
  }, [])

  const handleFileSelection = (file: File | null) => {
    if (!file) return

    if (!isAllowedFile(file)) {
      setSelectedFile(null)
      setError("Only .docx or .pdf files are supported.")
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setError("File size must be 10 MB or smaller.")
      return
    }

    setSelectedFile(file)
    setStoredFileMeta({
      name: file.name,
      sizeLabel: formatFileSize(file.size),
    })
    setError(null)
  }

  const handleSave = async () => {
    const fileToUpload = selectedFile
    const payload = fileToUpload
      ? {
          name: fileToUpload.name,
          sizeLabel: formatFileSize(fileToUpload.size),
        }
      : storedFileMeta

    if (!payload || !fileToUpload) {
      setError("Please upload your I9 form before saving.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const applicantId = await resolveApplicantId()
      const fd = new FormData()
      fd.append("file", fileToUpload)
      fd.append("applicantId", applicantId)
      fd.append("section", "i9")

      const res = await fetch("/api/onboarding/agreement/upload", { method: "POST", body: fd })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Upload failed")
      }

      localStorage.setItem(I9_FILE_KEY, JSON.stringify(payload))
      router.push(applicationPath("/application/employee-agreement"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setStoredFileMeta(null)
    setError(null)
    localStorage.removeItem(I9_FILE_KEY)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const uploadedFile = selectedFile
    ? {
        name: selectedFile.name,
        sizeLabel: formatFileSize(selectedFile.size),
      }
    : storedFileMeta

  const hasUploadedFile = Boolean(uploadedFile)

  return (
    <OnboardingLayout
      cardClassName="md:grid-cols-[660px_400px]"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-14" style={contentStyle}>
        <div className="flex flex-1 flex-col gap-9">
          <h1 className="text-[24px] font-semibold leading-8 text-slate-900">
            {hasUploadedFile ? "Upload your files" : "Upload your I9 form"}
          </h1>

          {hasUploadedFile ? (
            <div className="space-y-6">
              <p className="text-[14px] font-normal leading-5 text-slate-700">
                File has been uploaded. Click submit to continue.
              </p>

              <div
                className="flex h-[66px] w-full max-w-[580px] items-center justify-between gap-2 rounded-lg border p-4"
                style={completedSurfaceStyle}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <BrandedSvgIcon
                    src="/icons/pdf-icon.svg"
                    className="h-6 w-6 flex-none"
                    color={branding.primaryHex}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold leading-5 text-[color:var(--brand-primary)]">
                      {uploadedFile?.name}
                    </p>
                    <p className="text-[14px] font-normal leading-5 text-slate-500">
                      {uploadedFile?.sizeLabel}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[color:var(--brand-primary)] transition hover:brightness-95"
                  style={brandSoftBgStyle}
                  aria-label="Remove uploaded file"
                >
                  <BrandedSvgIcon
                    src="/icons/delete-icon.svg"
                    className="h-[18px] w-[18px]"
                    color={branding.primaryHex}
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`w-full max-w-[580px] rounded-2xl border border-dashed px-8 py-10 transition ${
                  isDragging ? "" : "border-[color:var(--brand-primary)] bg-white"
                }`}
                style={isDragging ? dragActiveStyle : undefined}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setIsDragging(false)
                  handleFileSelection(event.dataTransfer.files?.[0] ?? null)
                }}
              >
                <div className="flex min-h-[168px] flex-col items-center justify-center gap-3 text-center">
                  <BrandedUploadIcon className="h-9 w-9" primaryHex={branding.primaryHex} />

                  <p className="text-[14px] font-normal leading-5 text-slate-900">
                    Drag your file(s) to start uploading
                  </p>

                  <div className="flex w-full max-w-[180px] items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[12px] font-normal leading-4 text-slate-500">OR</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-[color:var(--brand-primary)] bg-white px-4 text-[14px] font-normal leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5"
                  >
                    Browse files
                  </button>

                  <p className="text-center text-[14px] font-normal leading-5 tracking-[0.01em] text-slate-500">
                    Max 10 MB files are allowed
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[14px] font-normal leading-5 text-slate-500">
                  Only support .docx or pdf files
                </p>

                {error ? (
                  <p className="text-[14px] font-normal leading-5 text-rose-600">{error}</p>
                ) : null}
              </div>
            </>
          )}

          <div className="mt-auto grid grid-cols-2 gap-3 pt-8 sm:flex sm:items-center sm:justify-end sm:gap-4 sm:pt-10">
            <Link
              href={applicationPath("/application/employee-agreement")}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border border-[color:var(--brand-primary)] bg-white px-4 text-[16px] font-semibold leading-6 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 sm:w-auto sm:px-6"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-xl px-4 text-[16px] font-semibold leading-6 text-white transition hover:brightness-90 disabled:opacity-50 sm:w-auto sm:px-6"
              style={primaryBtnStyle}
            >
              {saving ? "Uploading..." : hasUploadedFile ? "Submit" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
