"use client"

import { APPLICATION_ROUTES, identityVerificationPath } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { isPdfFile } from "@/lib/document-upload-helpers"
import {
  APPLICANT_ACTION_ROW,
  APPLICANT_CONTENT_CLASS,
  APPLICANT_HEADER_ROW,
  APPLICANT_SHELL_CLASS,
  APPLICANT_TITLE_CLASS,
} from "@/app/application/applicant-onboarding-responsive"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import BrandedUploadIcon from "@/app/components/BrandedUploadIcon"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import DocumentFileThumbnail from "@/app/components/DocumentFileThumbnail"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { useOnboardingTenant } from "@/lib/tenant/use-onboarding-tenant"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"

type UploadSlot = { file: File | null; name?: string; url?: string }

export default function Step4Identity() {
  const branding = useTenantBranding()
  const { slug: tenantSlug } = useOnboardingTenant()
  const router = useRouter()
  const searchParams = useSearchParams()
  const stepKey = searchParams.get("stepKey")?.trim() || null

  const authorizationsHref = applicationPath(
    stepKey
      ? `${APPLICATION_ROUTES.authorizationsDocuments}?stepKey=${encodeURIComponent(stepKey)}`
      : APPLICATION_ROUTES.authorizationsDocuments,
    tenantSlug
  )

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
        router.push(authorizationsHref)
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
          ...(tenantSlug ? { tenant: tenantSlug } : {}),
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
      router.push(authorizationsHref)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push(authorizationsHref)
  }

  const clearSavedIdentityDoc = async (storageKey: "ssn" | "license") => {
    if (typeof window === "undefined") return
    try {
      const storedIdentity = localStorage.getItem("identityDocuments")
      if (storedIdentity) {
        const parsed = JSON.parse(storedIdentity) as Record<string, unknown>
        delete parsed[storageKey]
        localStorage.setItem("identityDocuments", JSON.stringify(parsed))
      }
    } catch {
      // ignore invalid cache
    }

    let applicantId = localStorage.getItem("applicantId")?.trim() || ""
    if (!applicantId) {
      const { data: userData } = await supabase.auth.getUser()
      applicantId = userData?.user?.id?.trim() || ""
    }
    if (!applicantId) return

    try {
      await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          ...(tenantSlug ? { tenant: tenantSlug } : {}),
          ...(storageKey === "ssn"
            ? { ssn_url: null, ssn_back_url: null }
            : { drivers_license_url: null, drivers_license_back_url: null }),
        }),
      })
    } catch {
      // best-effort; UI already cleared
    }
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
      className="block cursor-pointer rounded-xl border border-dashed border-[color:var(--brand-primary)] bg-white px-4 py-5 text-center transition hover:bg-[color:var(--brand-primary)]/5 sm:px-6 sm:py-8"
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
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-primary)]/40 bg-[color:var(--brand-primary)]/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <DocumentFileThumbnail
              file={slot.file}
              publicUrl={slot.url ?? null}
              fileName={slot.file?.name || slot.name || ""}
            />
            <div className="min-w-0 text-left">
              <p className="truncate text-[13px] font-semibold text-[color:var(--brand-primary)]">{slot.file?.name || slot.name}</p>
              {isPdfFile(slot.file ?? null, slot.file?.name || slot.name || "", slot.url ?? null) && (
                <p className="text-[10px] font-medium text-[color:var(--brand-secondary)]">PDF Document</p>
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
              const el = document.getElementById(id) as HTMLInputElement | null
              if (el) el.value = ""
              void clearSavedIdentityDoc(storageKey)
            }}
            className="cursor-pointer p-1"
            aria-label={`Remove ${storageKey} file`}
          >
            <BrandedSvgIcon
              src="/icons/delete-icon.svg"
              className="h-7 w-7"
              color={branding.primaryHex}
            />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand-primary)]/10">
            <BrandedUploadIcon className="h-[22px] w-[22px]" primaryHex={branding.primaryHex} />
          </div>
          <p className="text-[12px] text-slate-600 sm:text-[13px]">Drag your file(s) to start uploading</p>
          <p className="text-[11px] text-slate-400">OR</p>
          <span className="rounded-md border border-[color:var(--brand-primary)] px-4 py-1 text-[12px] font-medium text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary)]/5">
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
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className={APPLICANT_SHELL_CLASS} style={brandingToCssVars(branding)}>
        <OnboardingStepper />

        <div className={APPLICANT_CONTENT_CLASS}>
          <div className={`${APPLICANT_HEADER_ROW} mb-4 sm:mb-6`}>
            <h2 className={APPLICANT_TITLE_CLASS}>SSN &amp; Driver&apos;s License</h2>
            <button
              type="button"
              onClick={handleSkip}
              className="shrink-0 cursor-pointer text-[12px] font-medium leading-5 text-[color:var(--brand-primary)]"
            >
              Skip for Now →
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-[12px] text-red-600">
              {error}
            </p>
          )}

          <div className="space-y-5 sm:space-y-6">
            {/* SSN Card */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-800 sm:text-[14px]">SSN Card</p>
                <p className="shrink-0 text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="ssn-upload" storageKey="ssn" slot={ssnFile} setSlot={setSsnFile} />
            </div>

            {/* Driver's License */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-800 sm:text-[14px]">Driver&apos;s License</p>
                <p className="shrink-0 text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="license-upload" storageKey="license" slot={licenseFile} setSlot={setLicenseFile} />
            </div>

            <p className="text-[11px] text-slate-400">Only support png, jpg or pdf files</p>
          </div>

          <div className={APPLICANT_ACTION_ROW}>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="w-full cursor-pointer rounded-md border border-[color:var(--brand-primary)] bg-white px-3 py-2.5 text-[11px] font-medium leading-5 text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5 disabled:opacity-50 max-[399px]:px-3 sm:w-auto sm:px-5 sm:py-2 sm:text-[12px]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className={`group inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[11px] font-medium leading-5 text-white transition max-[399px]:px-3 sm:w-auto sm:gap-2 sm:px-6 sm:py-2 sm:text-[12px] ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-[color:var(--brand-primary)] hover:brightness-90"
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
