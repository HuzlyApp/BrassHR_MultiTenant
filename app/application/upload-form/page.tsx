"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import OnboardingLayout from "@/app/components/OnboardingLayout"

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

function Upload19FormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isGeneralUpload = searchParams.get("type") === "files"

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [storedFileMeta, setStoredFileMeta] = useState<UploadedFileMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

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

  const handleSave = () => {
    const payload = selectedFile
      ? {
          name: selectedFile.name,
          sizeLabel: formatFileSize(selectedFile.size),
        }
      : storedFileMeta

    if (!payload) {
      setError("Please upload your file before saving.")
      return
    }

    localStorage.setItem(I9_FILE_KEY, JSON.stringify(payload))
    
    if (isGeneralUpload) {
      router.push("/application/document-received")
    } else {
      router.push("/application/employee-agreement")
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
      rightPanelImageSrc="/images/nurse.jpg"
      rightPanelImageClassName="object-cover object-center grayscale opacity-60"
      rightPanelOverlayClassName="bg-white/65"
      rightPanelContentClassName="p-5"
      rightPanelInnerClassName="max-w-[300px] gap-8"
      logoClassName="h-[72px] w-[240px]"
      taglineClassName="max-w-[300px] text-[15px] leading-8 text-slate-900"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-14">
        <div className="flex flex-1 flex-col gap-9">
          <h1 className="text-[24px] font-semibold leading-8 text-slate-900">
            {isGeneralUpload ? "Upload your files" : "Upload your I9 form"}
          </h1>

          {hasUploadedFile ? (
            <div className="space-y-6">
              <p className="text-[14px] font-normal leading-5 text-slate-700">
                File has been uploaded. Click submit to continue.
              </p>

              <div className="flex h-[66px] w-full max-w-[580px] items-center justify-between gap-2 rounded-lg border border-[#28c7bf] bg-[#effcfb] p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Image
                    src="/icons/pdf-icon.svg"
                    alt="PDF file"
                    width={24}
                    height={24}
                    className="h-6 w-6 flex-none"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold leading-5 text-[#0D9488]">
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
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#0D9488] transition hover:bg-[#d9f7f3]"
                  aria-label="Remove uploaded file"
                >
                  <Image
                    src="/icons/delete-icon.svg"
                    alt="Delete file"
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px]"
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`w-full max-w-[580px] rounded-2xl border border-dashed px-8 py-10 transition ${
                  isDragging
                    ? "border-[#0D9488] bg-[#f0fffe]"
                    : "border-[#28c7bf] bg-white"
                }`}
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
                  <Image
                    src="/images/upload.svg"
                    alt="Upload file"
                    width={36}
                    height={36}
                    className="h-9 w-9"
                  />

                  <p className="text-[14px] font-normal leading-5 text-slate-900">
                    Drag your file(s) to start uploading
                  </p>

                  <div className="flex w-full max-w-[180px] items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[12px] font-normal leading-4 text-slate-500">
                      OR
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-[#28c7bf] px-4 text-[14px] font-normal leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
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
                    onChange={(event) =>
                      handleFileSelection(event.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[14px] font-normal leading-5 text-slate-500">
                  Only support .docx or pdf files
                </p>

                {error ? (
                  <p className="text-[14px] font-normal leading-5 text-rose-600">
                    {error}
                  </p>
                ) : null}
              </div>
            </>
          )}

          <div className="mt-auto flex items-center justify-end gap-4 pt-10">
            <Link
              href="/application/employee-agreement"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-[#0D9488] px-6 text-[16px] font-semibold leading-6 text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-[#0D9488] px-6 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#0b7a70]"
            >
              {hasUploadedFile ? "Submit" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}

export default function Upload19FormPage() {
  return (
    <Suspense fallback={null}>
      <Upload19FormContent />
    </Suspense>
  )
}
