"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { isPdfFile } from "@/lib/document-upload-helpers"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import DocumentFileThumbnail from "@/app/components/DocumentFileThumbnail"

type UploadSlot = { file: File | null; name?: string; url?: string }

export default function Step4Identity() {
  const router = useRouter()

  const [ssnFile, setSsnFile] = useState<UploadSlot>({ file: null })
  const [licenseFile, setLicenseFile] = useState<UploadSlot>({ file: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedIdentity = localStorage.getItem("identityDocuments")
    if (!storedIdentity) return
    try {
      const parsed = JSON.parse(storedIdentity) as {
        ssn?: { name?: string; url?: string }
        license?: { name?: string; url?: string }
      }
      if (parsed.ssn?.name) {
        setSsnFile({ file: null, name: parsed.ssn.name, url: parsed.ssn.url })
      }
      if (parsed.license?.name) {
        setLicenseFile({ file: null, name: parsed.license.name, url: parsed.license.url })
      }
    } catch {
      // ignore invalid cache
    }
  }, [])

  const uploadFile = async (
    file: File,
    folder: string,
    applicantId: string
  ): Promise<string> => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", folder)
    fd.append("applicantId", applicantId)

    const res = await fetch("/api/onboarding/upload-required-file", {
      method: "POST",
      body: fd,
    })

    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      publicUrl?: string
    }

    if (!res.ok) {
      throw new Error(json.error || "File upload failed")
    }
    if (!json.publicUrl) {
      throw new Error("Could not generate public URL")
    }

    return json.publicUrl
  }

  const handleNext = async () => {
    setError(null)
    const hasExistingDocs = Boolean(ssnFile.url && licenseFile.url)
    if (!ssnFile.file || !licenseFile.file) {
      if (hasExistingDocs) {
        router.push("/application/step-4-documents")
        return
      }
      setError("Please upload both SSN Card and Driver's License")
      return
    }
    setLoading(true)
    try {
      let applicantId = localStorage.getItem("applicantId")?.trim() || ""
      if (!applicantId) {
        const { data: userData } = await supabase.auth.getUser()
        applicantId = userData?.user?.id?.trim() || ""
      }
      if (!applicantId) {
        throw new Error("Missing applicant ID — complete Step 1 (review profile) first.")
      }
      localStorage.setItem("applicantId", applicantId)

      const ssnUrl = await uploadFile(ssnFile.file, "ssn", applicantId)
      const licenseUrl = await uploadFile(licenseFile.file, "license", applicantId)

      const docRes = await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          ssn_url: ssnUrl,
          drivers_license_url: licenseUrl,
        }),
      })
      const docJson = (await docRes.json().catch(() => ({}))) as { error?: string }
      if (!docRes.ok) {
        throw new Error(docJson.error || `Could not save document URLs (${docRes.status})`)
      }

      localStorage.setItem(
        "identityDocuments",
        JSON.stringify({
          ssn: { name: ssnFile.file.name, url: ssnUrl },
          license: { name: licenseFile.file.name, url: licenseUrl },
          uploadedAt: new Date().toISOString(),
        })
      )
      setSsnFile({ file: null })
      setLicenseFile({ file: null })
      router.push("/application/step-4-documents")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push("/application/step-4-documents")
  }

  const UploadBox = ({
    id,
    storageKey,
    slot,
    setSlot,
  }: {
    id: string
    storageKey: "ssn" | "license"
    slot: UploadSlot
    setSlot: (s: UploadSlot) => void
  }) => (
    <label
      htmlFor={id}
      className="block cursor-pointer rounded-xl border border-dashed border-[#0D9488] bg-white px-6 py-8 text-center transition hover:bg-[#f0fffe]"
    >
      <input
        id={id}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={(e) => {
          if (e.target.files?.[0]) setSlot({ file: e.target.files[0] })
        }}
      />
      {slot.file || slot.name ? (
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-[#9fded8] bg-[#ecfffd] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <DocumentFileThumbnail
              file={slot.file}
              publicUrl={slot.url ?? null}
              fileName={slot.file?.name || slot.name || ""}
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-[13px] font-semibold text-[#0D9488]">{slot.file?.name || slot.name}</p>
              {isPdfFile(slot.file ?? null, slot.file?.name || slot.name || "", slot.url ?? null) && (
                <p className="text-[10px] font-medium text-[#0f766e]">PDF Document</p>
              )}
              {slot.file ? (
                <p className="text-[11px] text-slate-400">
                  {(slot.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">Already uploaded</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSlot({ file: null, name: undefined, url: undefined })
              if (typeof window !== "undefined") {
                const el = document.getElementById(id) as HTMLInputElement | null
                if (el) el.value = ""
                const storedIdentity = localStorage.getItem("identityDocuments")
                if (!storedIdentity) return
                try {
                  const parsed = JSON.parse(storedIdentity) as Record<string, unknown>
                  delete parsed[storageKey]
                  localStorage.setItem("identityDocuments", JSON.stringify(parsed))
                } catch {
                  // ignore invalid cache
                }
              }
            }}
            className="cursor-pointer p-1"
            aria-label={`Remove ${storageKey} file`}
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
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6faf8]">
            <Image src="/images/upload.svg" alt="" width={22} height={22} />
          </div>
          <p className="text-[13px] text-slate-600">Drag your file(s) to start uploading</p>
          <p className="text-[11px] text-slate-400">OR</p>
          <span className="rounded-md border border-[#0D9488] px-4 py-1 text-[12px] font-medium text-[#0D9488] hover:bg-[#f0fffe]">
            Browse files
          </span>
          <p className="text-[10px] text-slate-400">Max 10 MB files are allowed</p>
        </div>
      )}
    </label>
  )

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/n1.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={4} completedThrough={3} />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
              SSN &amp; Driver&apos;s License
            </h2>
            <button
              type="button"
              onClick={handleSkip}
              className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488]"
            >
              Skip for Now →
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-[12px] text-red-600">
              {error}
            </p>
          )}

          <div className="space-y-6">
            {/* SSN Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold text-slate-800">SSN Card</p>
                <p className="text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="ssn-upload" storageKey="ssn" slot={ssnFile} setSlot={setSsnFile} />
            </div>

            {/* Driver's License */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold text-slate-800">Driver&apos;s License</p>
                <p className="text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="license-upload" storageKey="license" slot={licenseFile} setSlot={setLicenseFile} />
            </div>

            <p className="text-[11px] text-slate-400">Only support png, jpg or pdf files</p>
          </div>

          {/* Buttons */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className={`group inline-flex cursor-pointer items-center gap-2 rounded-md px-6 py-2 text-[12px] font-medium leading-5 text-white transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#0D9488] hover:bg-[#0b7a70]"
              }`}
            >
              {loading ? "Uploading..." : "Next"}
              {!loading && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
