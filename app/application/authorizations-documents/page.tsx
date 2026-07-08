"use client"

import { APPLICATION_ROUTES, identityVerificationPath } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingToCssVars } from "@/lib/tenant/tenant-branding"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import { useMarkStepInProgressIfPending } from "@/lib/onboarding/use-mark-step-in-progress-if-pending"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import DocumentFileThumbnail from "@/app/components/DocumentFileThumbnail"
import { AuthorizationsFirmaAgreementPanel } from "@/app/components/onboarding/AuthorizationsFirmaAgreementPanel"
import {
  isAuthorizationsSaveBlocked,
  shouldShowFirmaAgreementPanel,
  stepRequiresApplicantAgreement,
  stepRequiresIdentityDocuments,
} from "@/lib/onboarding/authorizations-documents-step"
import { skipOnboardingStep } from "@/lib/onboarding/skip-onboarding-step"
import { useApplicantSigningEmail } from "@/lib/onboarding/use-applicant-signing-email"
import { getScopedApplicantId } from "@/lib/tenant/scoped-storage"
import { isPdfFile, resolveStoragePublicUrl } from "@/lib/document-upload-helpers"

type IdentityPaths = {
  ssnFront: string | null
  ssnBack: string | null
  dlFront: string | null
  dlBack: string | null
}

function fileLabel(path: string) {
  const seg = path.split("/").pop() || path
  return seg.length > 40 ? `${seg.slice(0, 18)}…${seg.slice(-12)}` : seg
}

export default function DocumentsPage() {
  const branding = useTenantBranding()
  const router = useRouter()
  const onboarding = useOnboardingConfigOptional()
  const nav = useOnboardingStepNav()

  const [mounted, setMounted] = useState(false)

  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("step4AuthorizationAgreed") === "true"
  })
  const [identityPaths, setIdentityPaths] = useState<IdentityPaths>({
    ssnFront: null,
    ssnBack: null,
    dlFront: null,
    dlBack: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [agreementSigned, setAgreementSigned] = useState(false)

  const [signerEmail, setSignerEmail] = useState("")
  const [signerName, setSignerName] = useState("")
  const [docAutosave, setDocAutosave] = useState<"idle" | "saving" | "saved">("idle")
  const completingRef = useRef(false)

  const activeStep = useMemo(() => {
    if (nav.currentStep) return nav.currentStep
    const enabled = nav.enabledSteps ?? []
    return (
      enabled.find(
        (s) =>
          s.step_type === "authorizations" ||
          s.step_key === "authorizations" ||
          s.step_key === "authorization_background_check" ||
          s.step_key === "agreement_signature"
      ) ?? null
    )
  }, [nav.currentStep, nav.enabledSteps])

  const requiresFirmaSigning = shouldShowFirmaAgreementPanel(activeStep)
  const requiresAgreement = stepRequiresApplicantAgreement(activeStep)
  const requiresIdentityDocs = stepRequiresIdentityDocuments(activeStep)

  const identityUploadHref = useMemo(
    () => identityVerificationPath(nav.slug, activeStep?.step_key),
    [nav.slug, activeStep?.step_key]
  )

  const signingEmail = useApplicantSigningEmail({
    applicantId,
    tenantSlug: nav.slug,
  })

  useMarkStepInProgressIfPending({
    step: activeStep,
    disabled: !mounted,
    updateStepStatus: onboarding?.updateStepStatus,
  })

  useEffect(() => {
    if (agreementSigned) setAgreed(true)
  }, [agreementSigned])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem("step4AuthorizationAgreed", agreed ? "true" : "false")
  }, [agreed])

  const docDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (typeof window === "undefined" || !mounted) return
    if (docDraftTimer.current) clearTimeout(docDraftTimer.current)
    docDraftTimer.current = setTimeout(() => {
      try {
        setDocAutosave("saving")
        localStorage.setItem(
          "step4DocumentsDraft",
          JSON.stringify({
            signerEmail,
            signerName,
            updatedAt: Date.now(),
          })
        )
        setDocAutosave("saved")
        window.setTimeout(() => setDocAutosave("idle"), 1200)
      } catch {
        setDocAutosave("idle")
      }
    }, 650)
    return () => {
      if (docDraftTimer.current) clearTimeout(docDraftTimer.current)
    }
  }, [signerEmail, signerName, mounted])

  const step4DraftHydrated = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined" || !mounted || step4DraftHydrated.current) return
    step4DraftHydrated.current = true
    try {
      const raw = localStorage.getItem("step4DocumentsDraft")
      if (!raw) return
      const d = JSON.parse(raw) as { signerEmail?: string; signerName?: string }
      if (d.signerEmail?.trim()) setSignerEmail((prev) => prev.trim() || d.signerEmail!.trim())
      if (d.signerName?.trim()) setSignerName((prev) => prev.trim() || d.signerName!.trim())
    } catch {
      /* ignore */
    }
  }, [mounted])

  const identityDocsComplete = useMemo(() => {
    const { ssnFront, dlFront } = identityPaths
    return Boolean(ssnFront && dlFront)
  }, [identityPaths])

  const saveBlocked = isAuthorizationsSaveBlocked({
    step: activeStep,
    agreed,
    agreementSigned,
    identityDocsComplete,
  })

  useEffect(() => {
    const id = getScopedApplicantId()
    if (id) {
      setApplicantId(id)
    } else {
      router.push(applicationPath(APPLICATION_ROUTES.profileReview))
    }
  }, [router])

  useEffect(() => {
    if (!signingEmail.resolved) return
    if (signingEmail.email) {
      setSignerEmail(signingEmail.email)
    }
    const name = `${signingEmail.firstName} ${signingEmail.lastName}`.trim()
    if (name) setSignerName(name)
  }, [signingEmail])

  const refreshIdentityDocsStatus = useCallback(async () => {
    if (!applicantId) return
    const tenantQuery = nav.slug ? `&tenant=${encodeURIComponent(nav.slug)}` : ""
    const res = await fetch(
      `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}${tenantQuery}`
    )
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      documents?: {
        ssn_url?: string | null
        ssn_back_url?: string | null
        drivers_license_url?: string | null
        drivers_license_back_url?: string | null
      } | null
    }
    if (!res.ok) {
      console.error("[step-4-documents] worker-documents api", json)
      return
    }
    const docs = json.documents ?? null

    const t = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

    setIdentityPaths({
      ssnFront: t(docs?.ssn_url),
      ssnBack: t(docs?.ssn_back_url),
      dlFront: t(docs?.drivers_license_url),
      dlBack: t(docs?.drivers_license_back_url),
    })
  }, [applicantId, nav.slug])

  useEffect(() => {
    void refreshIdentityDocsStatus()
  }, [refreshIdentityDocsStatus])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshIdentityDocsStatus()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refreshIdentityDocsStatus])

  const publicUrl = useCallback((path: string) => {
    return supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(path).data.publicUrl
  }, [])

  const handleSaveAndContinue = async () => {
    if (saveBlocked) {
      if (requiresAgreement && !agreed) {
        setError("You must agree to the authorization.")
        return
      }

      if (requiresFirmaSigning && !agreementSigned) {
        setError("Please sign the authorization document in Firma before continuing.")
        return
      }

      if (requiresIdentityDocs && !identityDocsComplete) {
        setError("Upload SSN and driver’s license (front) on the identity step.")
        return
      }

      setError("Complete the required items before continuing.")
      return
    }

    if (!applicantId) {
      setError("Missing applicant session. Return to Step 1.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const ssn_url = resolveStoragePublicUrl(identityPaths.ssnFront, publicUrl)
      const drivers_license_url = resolveStoragePublicUrl(identityPaths.dlFront, publicUrl)
      const ssn_back_url = null
      const drivers_license_back_url = null

      const docRes = await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          ...(nav.slug ? { tenant: nav.slug } : {}),
          ssn_url,
          ssn_back_url,
          drivers_license_url,
          drivers_license_back_url,
        }),
      })
      const docJson = (await docRes.json()) as { error?: string }
      if (!docRes.ok) {
        throw new Error(docJson.error || "Could not save worker documents")
      }

      const stepKey = activeStep?.step_key
      if (stepKey) {
        await onboarding?.updateStepStatus?.(stepKey, "completed")
      }
      if (nav.nextRoute) router.push(nav.nextRoute)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipForNow = () => {
    localStorage.setItem("step4Skipped", "1")
    const nextRoute = nav.nextRoute
    void skipOnboardingStep({
      step: activeStep,
      updateStepStatus: onboarding?.updateStepStatus,
      completingRef,
      onNavigate: () => {
        if (nextRoute) router.push(nextRoute)
      },
    })
  }

  function IdentityFileCard({
    path,
    subtitle,
  }: {
    path: string | null
    subtitle: string
  }) {
    if (!path) {
      return (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
          Not uploaded
        </div>
      )
    }
    const url = resolveStoragePublicUrl(path, publicUrl)
    if (!url) {
      return (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
          Not uploaded
        </div>
      )
    }
    const pdf = isPdfFile(null, path, url)

    return (
      <div className="flex items-center gap-3 rounded-xl border border-[color:var(--brand-primary)]/30 bg-white p-3 shadow-sm">
        <DocumentFileThumbnail publicUrl={url} fileName={path} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">{subtitle}</p>
          {pdf ? (
            <p className="text-[11px] font-medium text-[color:var(--brand-secondary)]">PDF Document</p>
          ) : null}
          <p className="text-sm font-medium text-gray-900 truncate" title={fileLabel(path)}>
            {fileLabel(path)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(identityUploadHref)}
          className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
          aria-label="Replace file"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    )
  }

  if (!mounted) return null

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8" style={brandingToCssVars(branding)}>
        <OnboardingStepper />

        <div className="flex flex-1 flex-col pt-8">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold text-slate-900 leading-[1.1]">
              Authorizations &amp; Documents
            </h1>
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <AutosaveStatus
                state={
                  docAutosave === "saving" ? "saving" : docAutosave === "saved" ? "saved" : "idle"
                }
              />
              <button
                type="button"
                onClick={handleSkipForNow}
                className="text-[12px] font-medium leading-5 text-[color:var(--brand-primary)]"
              >
                Skip for Now →
              </button>
            </div>
          </div>

          <div className="text-[13px] leading-6 text-slate-600 space-y-3 mb-8">
            <p>
              By selecting <span className="font-semibold text-slate-900">“I Agree,”</span> I authorize the Company to conduct a background check and, if required, a drug screening as part of my application or continued engagement.
            </p>
            <p>
              I understand this may include verification of my identity, employment history, education, and criminal records as permitted by law.
            </p>
            <p>
              I consent to the lawful collection, use, and disclosure of this information and release the Company from liability related to these authorized checks.
            </p>
          </div>

          <div className="mb-8">
            <OnboardingCheckbox
              checked={agreed}
              disabled={agreementSigned}
              onChange={setAgreed}
              className={agreementSigned ? "cursor-default opacity-90" : ""}
            >
              <span className="text-slate-800 font-medium">I Agree to the Authorization</span>
            </OnboardingCheckbox>
          </div>

          <AuthorizationsFirmaAgreementPanel
            applicantId={applicantId}
            step={requiresFirmaSigning ? activeStep : null}
            tenantSlug={nav.slug}
            signerEmail={signerEmail}
            signerEmailLoading={signingEmail.loading}
            agreed={agreed}
            configLoading={nav.configLoading && requiresFirmaSigning}
            onSignedChange={setAgreementSigned}
          />

          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="text-[15px] font-semibold text-slate-900">Add Documents</p>
              <button
                type="button"
                onClick={() => router.push(identityUploadHref)}
                className="text-[12px] font-medium text-[color:var(--brand-primary)]"
              >
                Edit uploads
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-semibold text-slate-900 mb-3">SSN Card</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IdentityFileCard path={identityPaths.ssnFront} subtitle="Front" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-semibold text-slate-900">Driver&apos;s License</p>
                  <p className="text-[11px] text-slate-500">front only</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IdentityFileCard path={identityPaths.dlFront} subtitle="Front" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-4">Only PNG, JPG, or PDF • Max 10 MB per file</p>
          </div>

          {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-[color:var(--brand-primary)] bg-white px-6 py-2 text-[12px] font-medium text-[color:var(--brand-primary)] transition hover:bg-[color:var(--brand-primary)]/5"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndContinue()}
              disabled={saving || saveBlocked}
              className={`rounded-lg px-6 py-2 text-[12px] font-medium text-white transition ${
                saving || saveBlocked
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[color:var(--brand-primary)] hover:brightness-90"
              }`}
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
