"use client"

import { APPLICATION_ROUTES } from "@/lib/onboarding/application-routes"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, Trash2 } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox"
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider"
import { useOnboardingStepNav } from "@/lib/onboarding/use-onboarding-step-nav"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import DocumentFileThumbnail from "@/app/components/DocumentFileThumbnail"
import { isPdfFile, resolveStoragePublicUrl } from "@/lib/document-upload-helpers"
import {
  fetchZohoSignStatus,
  mapZohoStatusToLabel,
  sendAgreement,
  subscribeToZohoSignStatus,
  type ZohoSignDbStatus,
} from "@/lib/zoho-sign-status"
import { resolveZohoSignEmbedHostForClient } from "@/lib/zoho-sign-embed-host"

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
  const router = useRouter()
  const onboarding = useOnboardingConfigOptional()
  const nav = useOnboardingStepNav()

  const [mounted, setMounted] = useState(false)
  const [showAuthPdf, setShowAuthPdf] = useState(false)

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
  const [zohoNote, setZohoNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [signerEmail, setSignerEmail] = useState("")
  const [signerName, setSignerName] = useState("")

  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [signingLoading, setSigningLoading] = useState(false)
  const [envelopeId, setEnvelopeId] = useState<string | null>(null)
  const [zohoDocumentId, setZohoDocumentId] = useState<string | null>(null)
  const [isSigned, setIsSigned] = useState(false)
  const [signingCompleteManual, setSigningCompleteManual] = useState(false)
  const [signingPopupOpened, setSigningPopupOpened] = useState(false)
  const [signingStatus, setSigningStatus] = useState<ZohoSignDbStatus>("sent")
  /** Email already has a non-declined onboarding Zoho row — do not call send-agreement again. */
  const [onboardingAgreementLocked, setOnboardingAgreementLocked] = useState(false)
  const [docAutosave, setDocAutosave] = useState<"idle" | "saving" | "saved">("idle")

  const signedFromStatus = signingStatus === "signed" || signingStatus === "completed"
  const effectiveSigned = isSigned || signedFromStatus

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (signedFromStatus) setAgreed(true)
  }, [signedFromStatus])

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

  useEffect(() => {
    const id = localStorage.getItem("applicantId")
    if (id) {
      setApplicantId(id)
    } else {
      router.push(applicationPath(APPLICATION_ROUTES.profileReview))
    }
  }, [router])

  useEffect(() => {
    const saved = localStorage.getItem("parsedResume")
    if (!saved) return
    try {
      const p = JSON.parse(saved) as Record<string, string>
      const em = (p.email || "").trim()
      const fn = (p.firstName || p.first_name || "").trim()
      const ln = (p.lastName || p.last_name || "").trim()
      if (em) setSignerEmail(em.toLowerCase())
      if (fn || ln) setSignerName(`${fn} ${ln}`.trim())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const existingRequestId = localStorage.getItem("signingRequestId")?.trim()
    if (existingRequestId) {
      setEnvelopeId(existingRequestId)
    }
    const cachedStatus = (localStorage.getItem("signingStatus") || "").trim().toLowerCase()
    if (
      cachedStatus === "sent" ||
      cachedStatus === "viewed" ||
      cachedStatus === "signed" ||
      cachedStatus === "completed" ||
      cachedStatus === "declined"
    ) {
      setSigningStatus(cachedStatus as ZohoSignDbStatus)
    }
  }, [])

  useEffect(() => {
    if (envelopeId) localStorage.setItem("signingRequestId", envelopeId)
    localStorage.setItem("signingStatus", signingStatus)
  }, [envelopeId, signingStatus])

  useEffect(() => {
    if (!applicantId) return
    void supabase
      .from("worker")
      .select("email, first_name, last_name")
      .eq("user_id", applicantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email?.trim()) setSignerEmail(data.email.trim().toLowerCase())
        const fn = (data?.first_name || "").trim()
        const ln = (data?.last_name || "").trim()
        if (fn || ln) setSignerName(`${fn} ${ln}`.trim())
      })
  }, [applicantId])

  const refreshIdentityDocsStatus = useCallback(async () => {
    if (!applicantId) return
    const res = await fetch(
      `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}`
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
  }, [applicantId])

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

  const startSigning = useCallback(async () => {
    if (!agreed) {
      setError("Please agree to the authorization first.")
      return
    }
    if (!signerEmail || !signerName) {
      setError("Missing your name or email. Complete Step 1 (review your profile) first.")
      return
    }
    if (!applicantId) return

    setSigningLoading(true)
    setError(null)
    setSigningCompleteManual(false)

    try {
      // Zoho requires an https `host`; bare domains in NEXT_PUBLIC_APP_URL are normalized.
      // On http://localhost, use env or ZOHO_SIGN_EMBED_HOST (Edge secret) for the embed host.
      const embedHost = resolveZohoSignEmbedHostForClient(
        process.env.NEXT_PUBLIC_APP_URL || "",
        window.location.origin,
      )

      const data = await sendAgreement({
        name: signerName,
        email: signerEmail.trim().toLowerCase(),
        user_id: applicantId,
        project_id: "onboarding",
        host: embedHost,
      })

      setEnvelopeId(data.request_id)
      setZohoDocumentId(data.zoho_document_id?.trim() || null)
      setSigningStatus(data.status || "sent")
      localStorage.setItem("signingRequestId", data.request_id)
      setOnboardingAgreementLocked(true)

      // Environment detection: use window.open() on localhost, modal iframe on production
      // Zoho frequently blocks iframe embedding on localhost, so we use a popup instead
      const isLocalhost =
        window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"

      if (data.signing_url) {
        if (isLocalhost) {
          // Localhost: open signing URL in new tab/window to avoid iframe issues
          console.log("[step-4] Opening Zoho signing in new tab (localhost environment)")
          window.open(data.signing_url, "_blank", "noopener,noreferrer,width=1024,height=800")
          setSigningPopupOpened(true)
          setSigningCompleteManual(false)
        } else {
          // Production: show embedded signing modal with iframe
          console.log("[step-4] Opening Zoho signing modal (production environment)")
          setSigningUrl(data.signing_url)
          setSigningPopupOpened(false)
          setSigningCompleteManual(false)
        }
      } else {
        setSigningUrl(null)
        setSigningPopupOpened(false)
        setSigningCompleteManual(true)
        const hint =
          (data.signing_url_error && String(data.signing_url_error).trim()) ||
          "Could not generate embedded signing URL. Set NEXT_PUBLIC_APP_URL=https://your-domain.com in .env.local (restart dev) or set ZOHO_SIGN_EMBED_HOST in Supabase Edge Function secrets."
        setError(hint)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signing setup failed"
      setError(message)
    } finally {
      setSigningLoading(false)
    }
  }, [agreed, applicantId, signerEmail, signerName])

  const refreshSigningStatus = useCallback(async () => {
    const email = signerEmail.trim().toLowerCase()
    try {
      if (email) {
        const rowByEmail = await fetchZohoSignStatus({ email, reconcile: true })
        if (rowByEmail?.request_id) {
          setEnvelopeId(rowByEmail.request_id)
          setZohoDocumentId(rowByEmail.zoho_document_id?.trim() || null)
          setSigningStatus(rowByEmail.status || "sent")
          localStorage.setItem("signingRequestId", rowByEmail.request_id)
          setOnboardingAgreementLocked(rowByEmail.status !== "declined")
          if (rowByEmail.status === "signed" || rowByEmail.status === "completed") {
            setAgreed(true)
          }
          return
        }
        setOnboardingAgreementLocked(false)
      }
      if (envelopeId) {
        const rowById = await fetchZohoSignStatus({ requestId: envelopeId, reconcile: true })
        if (rowById?.request_id) {
          setEnvelopeId(rowById.request_id)
          setZohoDocumentId(rowById.zoho_document_id?.trim() || null)
          if (rowById.status) setSigningStatus(rowById.status)
          localStorage.setItem("signingRequestId", rowById.request_id)
          setOnboardingAgreementLocked(rowById.status !== "declined")
          if (rowById.status === "signed" || rowById.status === "completed") {
            setAgreed(true)
          }
          return
        }
        // Stored request_id is stale/missing in DB; clear and let email lookup recover.
        localStorage.removeItem("signingRequestId")
        setEnvelopeId(null)
        setZohoDocumentId(null)
        setOnboardingAgreementLocked(false)
      }
    } catch {
      // ignore
    }
  }, [signerEmail, envelopeId])

  useEffect(() => {
    if (!envelopeId) return

    let cancelled = false
    void (async () => {
      try {
        const row = await fetchZohoSignStatus({ requestId: envelopeId, reconcile: true })
        if (!cancelled && row?.status) {
          setSigningStatus(row.status)
          setZohoDocumentId(row.zoho_document_id?.trim() || null)
          setOnboardingAgreementLocked(row.status !== "declined")
          if (row.status === "signed" || row.status === "completed") setAgreed(true)
        }
      } catch {
        // ignore
      }
    })()

    const unsubscribe = subscribeToZohoSignStatus({
      requestId: envelopeId,
      onStatusChange: (next) => {
        setSigningStatus(next.status)
        setZohoDocumentId(next.zoho_document_id?.trim() || null)
        if (next.status === "signed" || next.status === "completed") {
          setAgreed(true)
          setOnboardingAgreementLocked(true)
        }
        if (next.status === "declined") setOnboardingAgreementLocked(false)
      },
    })

    const pollingInterval = window.setInterval(() => {
      void refreshSigningStatus()
    }, 5000)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(pollingInterval)
    }
  }, [envelopeId, refreshSigningStatus])

  // After refresh, localStorage request_id can be stale. Latest row for this email is source of truth.
  useEffect(() => {
    const email = signerEmail.trim()
    if (!email) return

    let cancelled = false
    void (async () => {
      try {
        const row = await fetchZohoSignStatus({ email: email.toLowerCase(), reconcile: true })
        if (cancelled) return
        if (!row?.request_id) {
          setOnboardingAgreementLocked(false)
          return
        }
        setEnvelopeId(row.request_id)
        setZohoDocumentId(row.zoho_document_id?.trim() || null)
        setSigningStatus(row.status || "sent")
        localStorage.setItem("signingRequestId", row.request_id)
        setOnboardingAgreementLocked(row.status !== "declined")
        if (row.status === "signed" || row.status === "completed") setAgreed(true)
      } catch {
        if (!cancelled) setOnboardingAgreementLocked(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [signerEmail])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshSigningStatus()
    }
    const onPageShow = () => {
      void refreshSigningStatus()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [refreshSigningStatus])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const d = event.data
      if (
        (d?.source === "zoho-sign" || d?.source === "signing") &&
        d?.event === "signing_complete"
      ) {
        setIsSigned(true)
        setSigningUrl(null)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  const syncZoho = async () => {
    if (!applicantId) return
    setZohoNote(null)
    try {
      const res = await fetch("/api/zoho/sync-onboarding-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 503 || String(data.error || "").includes("not configured")) {
          setZohoNote("Zoho sync skipped (not configured on server).")
          return
        }
        setZohoNote(data.error || "Zoho sync did not complete.")
        return
      }
      if (typeof data.synced === "number" && data.synced > 0) {
        setZohoNote(`Synced ${data.synced} file(s) to Zoho Recruit.`)
      }
    } catch {
      setZohoNote("Zoho sync failed.")
    }
  }

  const handleSaveAndContinue = async () => {
    if (!agreed) {
      setError("You must agree to the authorization.")
      return
    }

    if (!effectiveSigned) {
      setError("Please sign the authorization document first.")
      return
    }

    if (!identityDocsComplete) {
      setError("Upload SSN and driver’s license (front) on the identity step.")
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

      await syncZoho()
      const authStep = onboarding?.config?.steps.find(
        (s) => s.is_enabled && (s.step_key === "authorizations" || s.step_type === "authorizations")
      )
      if (authStep?.step_key) {
        await onboarding?.updateStepStatus?.(authStep.step_key, "completed")
      }
      if (nav.nextRoute) router.push(nav.nextRoute)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipForNow = async () => {
    localStorage.setItem("step4Skipped", "1")
    const authStep = onboarding?.config?.steps.find(
      (s) => s.is_enabled && (s.step_key === "authorizations" || s.step_type === "authorizations")
    )
    if (authStep?.step_key) {
      await onboarding?.updateStepStatus?.(authStep.step_key, "skipped")
    }
    if (nav.nextRoute) router.push(nav.nextRoute)
  }

  const openZohoDocument = useCallback(
    (mode: "preview" | "download") => {
      if (!envelopeId) return
      const qs = new URLSearchParams({
        request_id: envelopeId,
        mode,
      })
      if (zohoDocumentId) qs.set("document_id", zohoDocumentId)
      const url = `/api/zoho-sign/document?${qs.toString()}`
      if (mode === "download") {
        window.location.href = url
        return
      }
      window.open(url, "_blank", "noopener,noreferrer")
    },
    [envelopeId, zohoDocumentId]
  )

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
      <div className="rounded-xl border border-teal-200 bg-white p-3 shadow-sm flex gap-3 items-center">
        <DocumentFileThumbnail publicUrl={url} fileName={path} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">{subtitle}</p>
          {pdf ? (
            <p className="text-[11px] font-medium text-teal-800">PDF Document</p>
          ) : null}
          <p className="text-sm font-medium text-gray-900 truncate" title={fileLabel(path)}>
            {fileLabel(path)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(applicationPath(APPLICATION_ROUTES.identityVerification))}
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
      rightPanelImageSrc="/images/n1.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      {showAuthPdf && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Auth Release form"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAuthPdf(false)
          }}
        >
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 truncate">Auth Release form.pdf</p>
              <button
                type="button"
                onClick={() => setShowAuthPdf(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="h-[80vh] bg-white">
              <iframe
                title="Auth Release form"
                src="/docs/Auth%20Release%20form.pdf"
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
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
                className="text-[12px] font-medium leading-5 text-[#0D9488]"
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
              disabled={signedFromStatus}
              onChange={setAgreed}
              className={signedFromStatus ? "cursor-default opacity-90" : ""}
            >
              <span className="text-slate-800 font-medium">I Agree to the Authorization</span>
            </OnboardingCheckbox>
          </div>

          <div className="rounded-3xl border border-[#0D9488] bg-[#f0fffe] p-6 shadow-sm mb-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d3f7f0] text-[#0D9488]">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Onboarding Agreement</p>
                  <p className="text-xs text-slate-500">Mandatory</p>
                </div>
              </div>

              {!signingUrl && !effectiveSigned && (
                <button
                  type="button"
                  onClick={() => {
                    // If Zoho signing isn't configured (common in local/dev), fall back to showing the PDF.
                    // On live, Zoho env vars will be present and this will launch embedded signing.
                    if (!signerEmail || !signerName || !applicantId) {
                      setShowAuthPdf(true)
                      return
                    }
                    void startSigning()
                  }}
                  disabled={signingLoading || !agreed}
                  className={`rounded-xl px-5 py-2 text-[12px] font-semibold text-white transition ${
                    signingLoading || !agreed
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#0D9488] hover:bg-[#0b7a70]"
                  }`}
                >
                  {signingLoading ? "Preparing..." : "Click and Sign"}
                </button>
              )}

              {effectiveSigned && (
                <span className="rounded-xl bg-[#0D9488] px-5 py-2 text-[12px] font-semibold text-white">Signed</span>
              )}
            </div>

            {envelopeId && (
              <p className="mt-4 text-xs text-slate-500 truncate">Request ID: {envelopeId}</p>
            )}

            <p className="mt-2 text-sm text-slate-700">
              Status: <span className="font-semibold">{mapZohoStatusToLabel(signingStatus)}</span>
            </p>

            {envelopeId && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openZohoDocument("preview")}
                  className="rounded-lg border border-[#0D9488] px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-[#eafffd]"
                >
                  Preview document
                </button>
                <button
                  type="button"
                  onClick={() => openZohoDocument("download")}
                  className="rounded-lg border border-[#0D9488] px-3 py-1.5 text-xs font-semibold text-[#0D9488] hover:bg-[#eafffd]"
                >
                  Download PDF
                </button>
              </div>
            )}

            {signingPopupOpened && (
              <p className="mt-2 text-xs text-slate-500">
                A signing window has been opened — complete your signature there, then return here.
              </p>
            )}

            {/* Fullscreen Modal for Embedded Signing */}
            {signingUrl && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                <div className="relative w-full max-w-6xl h-[90vh] sm:h-[95vh] bg-white rounded-xl overflow-hidden shadow-2xl flex flex-col">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-slate-900">Sign Agreement</p>
                      <p className="text-xs text-slate-500 mt-0.5">Use Type, Draw, or Upload to sign</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSigningUrl(null)}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition flex-shrink-0"
                      aria-label="Close signing modal"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Content - Iframe Container */}
                  <div className="flex-1 overflow-hidden bg-slate-50">
                    <iframe
                      title="Zoho Sign - Embedded Signing"
                      src={signingUrl}
                      className="w-full h-full border-0"
                      allow="clipboard-write; camera; microphone; fullscreen; payment; geolocation; accelerometer; gyroscope"
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
                    <p className="text-xs text-slate-500">
                      Complete your signature above, then the modal will close automatically upon signing completion.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="text-[15px] font-semibold text-slate-900">Add Documents</p>
              <button
                type="button"
                onClick={() => router.push(applicationPath(APPLICATION_ROUTES.identityVerification))}
                className="text-[12px] font-medium text-[#0D9488]"
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
          {zohoNote && <p className="mb-4 text-[#0D9488] text-sm">{zohoNote}</p>}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-[#0D9488] bg-white px-6 py-2 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndContinue()}
              disabled={saving || !agreed || !effectiveSigned || !identityDocsComplete}
              className={`rounded-lg px-6 py-2 text-[12px] font-medium text-white transition ${
                saving || !agreed || !effectiveSigned || !identityDocsComplete
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#0D9488] hover:bg-[#0b7a70]"
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
