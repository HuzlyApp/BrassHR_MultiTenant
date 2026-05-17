"use client"

import { applicationPath } from "@/lib/tenant/with-tenant"
import type { HTMLAttributes, ReactNode } from "react"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import Image from "next/image"
import { AlertTriangle, ChevronDown, Pencil, Search, X, XCircle } from "lucide-react"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingLoader from "@/app/components/OnboardingLoader"
import { formatPhoneNumber, normalizePhoneInput } from "@/lib/phone"
import {
  isValidStep1Email,
  validateStep1Form,
  step1ZipInlineMessage,
} from "@/lib/onboardingStep1Validation"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id"

type ContactConflictKind = "email" | "phone"

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
]

const POPULAR_CITIES = [
  "Los Angeles", "San Diego", "San Francisco", "Sacramento", "Phoenix", "Las Vegas",
  "Dallas", "Houston", "Austin", "Chicago", "Miami", "Orlando", "Atlanta", "New York",
  "Brooklyn", "Queens", "Boston", "Seattle", "Portland", "Denver", "Nashville", "Charlotte",
]

type EditableInputProps = {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
  hint?: string
  iconSlot?: ReactNode
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  disabled?: boolean
}

function EditableInput({
  label,
  value,
  placeholder,
  onChange,
  required,
  className,
  hint,
  iconSlot,
  inputMode,
  disabled,
}: EditableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="flex justify-between flex-wrap gap-1">
        <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-gray-400 mt-0.5">{hint}</span> : null}
      </div>
      <div className="group relative">
        {iconSlot ? (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{iconSlot}</div>
        ) : null}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          placeholder={placeholder}
          inputMode={inputMode}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

type SearchableSelectProps = {
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
  required?: boolean
}

function SearchableSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  required,
}: SearchableSelectProps) {
  const focusBorderClass = "focus:outline-none focus:border-[#22c7c8] focus:ring-2 focus:ring-[#22c7c8]/20"
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery("")
    }
  }, [open])

  return (
    <div ref={wrapperRef}>
      <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`w-full px-4 h-[56px] border border-gray-200 rounded-md text-left text-[#1e293b] text-sm bg-white font-medium flex items-center justify-between ${focusBorderClass}`}
        >
          <span className={value ? "text-[#1e293b]" : "text-gray-400"}>{value || placeholder}</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 w-full rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="relative p-2 border-b border-slate-100">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label}`}
                className={`w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-[#111827] placeholder:text-slate-400 [color-scheme:light] ${focusBorderClass}`}
              />
            </div>
            <div className="max-h-44 overflow-y-auto py-1">
              {filteredOptions.length ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                      setQuery("")
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-50"
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">No result found</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Step1ReviewContent() {
  const focusBorderClass = "focus:outline-none focus:border-[#22c7c8] focus:ring-2 focus:ring-[#22c7c8]/20"
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlJobTitle = useMemo(() => {
    return (
      searchParams.get("jobTitle") ||
      searchParams.get("job_title") ||
      searchParams.get("jobRole") ||
      searchParams.get("role") ||
      ""
    ).trim()
  }, [searchParams])

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    email: "",
    jobRole: "",
    sameAsAddress1: false,
  })

  const [loading, setLoading] = useState(false)
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle")
  /** Duplicate contact conflict: banner + field highlight (matches design mock). */
  const [fieldConflict, setFieldConflict] = useState<{
    kind: ContactConflictKind
    bannerVisible: boolean
  } | null>(null)
  const [genericError, setGenericError] = useState<string | null>(null)
  /** After first "Save & continue", show incomplete-field message until the form is valid. */
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Load parsed resume data from PDF
  useEffect(() => {
    // `applicantId` is set by `app/application/layout.tsx` to match `auth.users.id` (anon sign-in).
    // Do not mint random UUIDs here — `worker.user_id` has a foreign key to Auth.

    const saved = localStorage.getItem("parsedResume")
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      setForm({
        firstName: parsed.first_name || parsed.FirstName || "",
        lastName: parsed.last_name || parsed.LastName || "",
        address1: parsed.address1 || parsed.address || parsed.Address || "",
        address2: parsed.address2 || "",
        city: parsed.city || parsed.City || "",
        state: parsed.state || parsed.State || "",
        zipCode: String(parsed.zipCode || parsed.zip || "")
          .replace(/\D/g, "")
          .slice(0, 5),
        phone: normalizePhoneInput(parsed.phone || parsed.Phone || ""),
        email: parsed.email || parsed.Email || "",
        jobRole: urlJobTitle || parsed.job_role || parsed.JobRole || parsed.job_title || "",
        sameAsAddress1: false,
      })
    } catch (e) {
      console.error("Failed to parse resume data", e)
    }
  }, [urlJobTitle])

  useEffect(() => {
    if (!urlJobTitle) return
    setForm((prev) => ({
      ...prev,
      jobRole: prev.jobRole || urlJobTitle,
    }))
  }, [urlJobTitle])

  const zipFieldError = useMemo(() => step1ZipInlineMessage(form.zipCode), [form.zipCode])

  const emailFieldError = useMemo(() => {
    if (!form.email.trim()) return null
    return isValidStep1Email(form.email) ? null : "Enter a valid email address."
  }, [form.email])

  const phoneFieldError = useMemo(() => {
    const digits = normalizePhoneInput(form.phone)
    if (!digits) return null
    return digits.length === 10 ? null : "Enter a valid 10-digit US phone number."
  }, [form.phone])

  const step1Issue = useMemo(() => validateStep1Form(form), [form])

  const validationBannerText = useMemo(() => {
    if (!step1Issue) return null
    if (step1Issue.code !== "INCOMPLETE") return step1Issue.message
    return submitAttempted ? step1Issue.message : null
  }, [step1Issue, submitAttempted])

  const handleChange = (key: string, value: string | boolean) => {
    setGenericError(null)
    if (key === "email" && fieldConflict?.kind === "email") setFieldConflict(null)
    if (key === "phone" && fieldConflict?.kind === "phone") setFieldConflict(null)
    if (key === "zipCode" && typeof value === "string") {
      setForm((prev) => ({ ...prev, zipCode: value.replace(/\D/g, "").slice(0, 5) }))
      return
    }
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const persistResumeDraft = useCallback(async (): Promise<boolean> => {
    const applicantId = localStorage.getItem("applicantId")?.trim() || ""
    if (!applicantId) return false
    if (validateStep1Form(form)) return false

    const payload = {
      applicantId,
      firstName: form.firstName,
      lastName: form.lastName,
      address1: form.address1,
      address2: form.address2,
      city: form.city,
      state: form.state,
      zipCode: form.zipCode,
      phone: form.phone,
      email: form.email,
      jobRole: form.jobRole,
    }

    const saveRes = await fetch("/api/onboarding/save-worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!saveRes.ok) return false

    localStorage.setItem(
      "parsedResume",
      JSON.stringify({
        first_name: form.firstName,
        last_name: form.lastName,
        address1: form.address1,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        phone: form.phone,
        email: form.email,
        job_role: form.jobRole,
        firstName: form.firstName,
        lastName: form.lastName,
        jobRole: form.jobRole,
      })
    )
    return true
  }, [form])

  useEffect(() => {
    if (loading) return
    const t = window.setTimeout(() => {
      void (async () => {
        const applicantId = localStorage.getItem("applicantId")?.trim() || ""
        if (!applicantId || validateStep1Form(form)) return
        setAutosaveState("saving")
        const ok = await persistResumeDraft()
        if (ok) {
          setAutosaveState("saved")
          window.setTimeout(() => setAutosaveState("idle"), 1400)
        } else {
          setAutosaveState("idle")
        }
      })()
    }, 700)
    return () => window.clearTimeout(t)
  }, [form, loading, persistResumeDraft])

  function describeSaveError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message
    if (err && typeof err === "object") {
      const e = err as { message?: string; details?: string; hint?: string; code?: string }
      const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x?.trim()))
      if (parts.length) return parts.join(" — ")
      if (e.code) return `Could not save (${e.code})`
    }
    return "Failed to save data"
  }

  const handleSaveAndContinue = async () => {
    setFieldConflict(null)
    setGenericError(null)
    setSubmitAttempted(true)
    const step1Err = validateStep1Form(form)
    if (step1Err) {
      return
    }

    setLoading(true)

    try {
      const applicantId = localStorage.getItem("applicantId") || ""
      if (!applicantId) throw new Error("Missing applicant ID")

      const { error: upsertBrowserError } = await supabase
        .from("worker")
        .upsert({
          applicant_id: applicantId,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          address1: form.address1.trim(),
          address2: form.address2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip_code: form.zipCode.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          job_role: form.jobRole.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "applicant_id" })
      if (upsertBrowserError) console.warn("[step-1-review] worker upsert", upsertBrowserError)
      // Create a new worker record on each save by generating a fresh applicantId.
      // This prevents overwriting the previous worker row keyed by user_id.
      // const applicantId = globalThis.crypto?.randomUUID?.()
      // if (!applicantId) throw new Error("Could not generate applicant ID")
      // localStorage.setItem("applicantId", applicantId)

      const payload = {
        applicantId,
        firstName: form.firstName,
        lastName: form.lastName,
        address1: form.address1,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        phone: form.phone,
        email: form.email,
        jobRole: form.jobRole,
      }

      const clientTenantId = getConfiguredDefaultTenantId()
      const workerRow = {
        ...(clientTenantId ? { tenant_id: clientTenantId } : {}),
        user_id: applicantId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zipCode.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        job_role: form.jobRole.trim(),
        updated_at: new Date().toISOString(),
      }

      const saveRes = await fetch("/api/onboarding/save-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let saveJson: { error?: string; hint?: string; code?: string } = {}
      try {
        saveJson = (await saveRes.json()) as { error?: string; hint?: string; code?: string }
      } catch {
        /* non-JSON error body */
      }

      if (saveRes.status === 409 && saveJson.code === "DUPLICATE_EMAIL") {
        setFieldConflict({ kind: "email", bannerVisible: true })
        return
      }

      if (
        saveRes.status === 503 &&
        (saveJson.error === "MISSING_SERVICE_ROLE_KEY" ||
          saveJson.error === "MISSING_SUPABASE_URL")
      ) {
        if (!clientTenantId) {
          throw new Error(
            'Multi-tenant database requires tenant_id on worker rows. Add NEXT_PUBLIC_DEFAULT_TENANT_ID to .env.local (your platform tenant UUID), or set SUPABASE_SERVICE_ROLE_KEY so the server can resolve the default tenant from public.tenants.',
          )
        }
        const emailCheck = await fetch("/api/onboarding/check-email-free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId, email: form.email.trim() }),
        })
        let emailCheckJson: { error?: string; code?: string } = {}
        try {
          emailCheckJson = (await emailCheck.json()) as { error?: string; code?: string }
        } catch {
          /* ignore */
        }
        if (emailCheck.status === 409 && emailCheckJson.code === "DUPLICATE_EMAIL") {
          setFieldConflict({ kind: "email", bannerVisible: true })
          return
        }

        const { supabaseBrowser: supabase } = await import("@/lib/supabase-browser")
        // Avoid upsert(..., onConflict: "user_id") in the browser — it requires a UNIQUE constraint on worker.user_id.
        // If the DB isn't migrated, upsert will either error or insert duplicates.
        const { data: existing, error: selErr } = await supabase
          .from("worker")
          .select("id")
          .eq("user_id", applicantId)
          .maybeSingle()
        if (selErr) {
          throw new Error(
            `${describeSaveError(selErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
          )
        }
        if (existing?.id) {
          const { user_id: _u, ...updatePayload } = workerRow as Record<string, unknown>
          const { error: upErr } = await supabase.from("worker").update(updatePayload).eq("id", existing.id)
          if (upErr) {
            throw new Error(
              `${describeSaveError(upErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
            )
          }
        } else {
          const { error: insErr } = await supabase.from("worker").insert(workerRow)
          if (insErr) {
            throw new Error(
              `${describeSaveError(insErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
            )
          }
        }
      } else if (!saveRes.ok) {
        throw new Error(
          saveJson.hint || saveJson.error || `Save failed (${saveRes.status})`
        )
      }

      const resumeStoragePath =
        typeof window !== "undefined"
          ? localStorage.getItem("resumeStoragePath")
          : null
      if (resumeStoragePath?.trim()) {
        try {
          const reqRes = await fetch("/api/onboarding/worker-requirements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicantId,
              resume_path: resumeStoragePath.trim(),
            }),
          })
          if (!reqRes.ok) {
            const j = (await reqRes.json().catch(() => ({}))) as { error?: string }
            console.warn(
              "[step-1-review] worker_requirements resume_path",
              j.error || reqRes.status
            )
          }
        } catch (e) {
          console.warn("[step-1-review] worker_requirements resume_path", e)
        }
      }

      // Save to localStorage for next steps (snake_case keys for steps that read parsedResume)
      localStorage.setItem(
        "parsedResume",
        JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          address1: form.address1,
          address2: form.address2,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          phone: form.phone,
          email: form.email,
          job_role: form.jobRole,
          firstName: form.firstName,
          lastName: form.lastName,
          jobRole: form.jobRole,
        })
      )
      localStorage.setItem("step1ReviewCompleted", "true")

      try {
        await fetch("/api/onboarding/progress/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicantId,
            stepKey: "resume_upload",
            status: "completed",
          }),
        })
      } catch {
        /* progress is best-effort; step 2 should still open */
      }

      router.push(applicationPath("/application/step-2-license"))

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save data"
      console.error(message, err)
      setGenericError(message)
    } finally {
      setLoading(false)
    }
  }

  const emailConflict = fieldConflict?.kind === "email"
  const phoneConflict = fieldConflict?.kind === "phone"
  const conflictBannerText =
    fieldConflict?.kind === "email"
      ? "Email was already used. Click to login using Email"
      : fieldConflict?.kind === "phone"
        ? "Phone was already used. Click to login using phone"
        : ""

  return (
    <div className="relative min-h-screen bg-[#1db4a3] flex items-stretch sm:items-center justify-center p-3 sm:p-4 py-6 sm:py-8">
      <div
        className={`bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative mx-auto w-full max-w-[1060px] md:min-h-[640px] min-h-0 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`}
      >
        {/* LEFT - Form */}
        <div className="w-full md:w-[65%] p-4 sm:p-6 md:p-10 flex flex-col justify-between min-w-0">
          <div className="min-w-0">
            <div className="overflow-x-auto -mx-1 px-1 pb-1">
              <div className="min-w-[520px] sm:min-w-0">
                <OnboardingStepper currentStep={1} />
              </div>
            </div>

            <div className="mt-4 sm:mt-6 mb-4 sm:mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl sm:text-[22px] font-bold text-[#1e293b]">Review resume details</h2>
              <AutosaveStatus
                state={autosaveState === "saving" ? "saving" : autosaveState === "saved" ? "saved" : "idle"}
              />
            </div>

            {(genericError || validationBannerText) && (
              <div
                role="alert"
                className="mb-5 p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-lg"
              >
                {genericError || validationBannerText}
              </div>
            )}

            <div className="space-y-4 sm:space-y-5">
              {/* Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <EditableInput
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={(value) => handleChange("firstName", value)}
                  className={`w-full px-4 h-[56px] border border-gray-200 rounded-md text-[#1e293b] text-sm bg-white font-medium pr-10 ${focusBorderClass}`}
                  placeholder="First Name"
                />
                <EditableInput
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={(value) => handleChange("lastName", value)}
                  className={`w-full px-4 h-[56px] border border-gray-200 rounded-md text-[#1e293b] text-sm bg-white pr-10 ${focusBorderClass}`}
                  placeholder="Last Name"
                />
              </div>

              {/* Address 1 */}
              <EditableInput
                label="Address 1"
                required
                hint="Street Address, P.O Box"
                value={form.address1}
                onChange={(value) => handleChange("address1", value)}
                className={`w-full px-4 h-[56px] border border-gray-200 rounded-md text-[#1e293b] text-sm bg-white pr-10 ${focusBorderClass}`}
                placeholder="1234 Main St, Apt 4B"
              />

              {/* Address 2 */}
              <EditableInput
                label="Address 2"
                required
                hint="Apt, Suite, Building, Floor, etc..."
                value={form.address2}
                onChange={(value) => handleChange("address2", value)}
                disabled={form.sameAsAddress1}
                className={`w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm pr-10 ${
                  form.sameAsAddress1 ? "bg-gray-50 text-gray-500" : "bg-white"
                }`}
                placeholder="Same as address 1"
              />

              {/* City, State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <SearchableSelect
                  label="City"
                  required
                  value={form.city}
                  placeholder="Select City"
                  options={POPULAR_CITIES}
                  onChange={(value) => handleChange("city", value)}
                />
                <SearchableSelect
                  label="State"
                  required
                  value={form.state}
                  placeholder="Select State"
                  options={US_STATES}
                  onChange={(value) => handleChange("state", value)}
                />
              </div>

              {fieldConflict?.bannerVisible ? (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
                    <p className="text-sm font-medium leading-snug text-red-800">{conflictBannerText}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="rounded-md border border-red-600 bg-white px-4 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() =>
                        setFieldConflict((prev) =>
                          prev ? { ...prev, bannerVisible: false } : null,
                        )
                      }
                      className="rounded p-1.5 text-red-500 hover:bg-red-100"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <label className="block text-[13px] font-medium text-gray-600">
                      Phone<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    {phoneConflict ? (
                      <span className="text-[11px] font-medium text-red-600">Phone was already used</span>
                    ) : null}
                  </div>
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                      <span className="relative block h-4 w-6 overflow-hidden rounded-[2px] border border-slate-300 bg-white">
                        <span className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,#b91c1c_0,#b91c1c_1.5px,#ffffff_1.5px,#ffffff_3px)]" />
                        <span className="absolute left-0 top-0 h-2.5 w-2.5 bg-[#1d4ed8]" />
                      </span>
                    </span>
                    <input
                      id="phone-input"
                      value={formatPhoneNumber(form.phone)}
                      onChange={(e) => handleChange("phone", normalizePhoneInput(e.target.value))}
                      className={`w-full pl-14 pr-11 h-[52px] sm:h-[56px] border rounded-md text-[#1e293b] text-sm bg-white ${
                        phoneConflict || phoneFieldError
                          ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                          : `border-gray-200 ${focusBorderClass}`
                      }`}
                      placeholder="(201) 512-2366"
                      inputMode="numeric"
                    />
                    {!phoneConflict ? (
                      <button
                        type="button"
                        onClick={() => document.getElementById("phone-input")?.focus()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        aria-label="Edit Phone"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                    {phoneConflict ? (
                      <XCircle
                        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {phoneFieldError && !phoneConflict ? (
                    <p className="mt-1.5 text-xs text-red-600" role="alert">
                      {phoneFieldError}
                    </p>
                  ) : null}
                </div>
                <div className="relative">
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <label className="block text-[13px] font-medium text-gray-600">
                      Email<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    {emailConflict ? (
                      <span className="text-[11px] font-medium text-red-600">Email was already used</span>
                    ) : null}
                  </div>
                  <div className="group relative">
                    <input
                      id="email-input"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className={`w-full px-4 pr-11 h-[52px] sm:h-[56px] border rounded-md text-[#1e293b] text-sm bg-white ${
                        emailConflict || emailFieldError
                          ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
                          : `border-gray-200 ${focusBorderClass}`
                      }`}
                      placeholder="rickashton@gmail.com"
                    />
                    {!emailConflict ? (
                      <button
                        type="button"
                        onClick={() => document.getElementById("email-input")?.focus()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        aria-label="Edit Email"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    ) : null}
                    {emailConflict ? (
                      <XCircle
                        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {emailFieldError && !emailConflict ? (
                    <p className="mt-1.5 text-xs text-red-600" role="alert">
                      {emailFieldError}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Zip & Job Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <EditableInput
                    label="Zip Code"
                    required
                    value={form.zipCode}
                    onChange={(value) => handleChange("zipCode", value)}
                    className={`w-full px-4 h-[56px] border rounded-md text-[#1e293b] text-sm bg-white pr-10 ${
                      zipFieldError
                        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none"
                        : `border-gray-200 ${focusBorderClass}`
                    }`}
                    placeholder="12345"
                    inputMode="numeric"
                  />
                  {zipFieldError ? (
                    <p className="mt-1.5 text-xs text-red-600" role="alert">
                      {zipFieldError}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">
                    Select Job Title<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={form.jobRole}
                      onChange={(e) => handleChange("jobRole", e.target.value)}
                      className={`w-full px-4 h-[56px] border border-gray-200 rounded-md text-[#1e293b] text-sm appearance-none bg-white font-medium ${focusBorderClass}`}
                    >
                      <option value="" disabled>
                        Select Job Title
                      </option>
                      <option value="CNA">CNA</option>
                      <option value="RN">RN</option>
                      <option value="LVN">LVN</option>
                      <option value="Medical Assistant">Medical Assistant</option>
                      <option value="Caregiver">Caregiver</option>
                      {form.jobRole &&
                      !["CNA", "RN", "LVN", "Medical Assistant", "Caregiver"].includes(form.jobRole) ? (
                        <option value={form.jobRole}>{form.jobRole}</option>
                      ) : null}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 md:hidden">
            <div className="flex flex-col items-center gap-3 text-center">
              <Image
                src="/images/new-logo-nexus.svg"
                alt="Nexus MedPro Logo"
                width={160}
                height={48}
                className="h-10 w-auto"
                priority
              />
              <p className="max-w-xs text-sm leading-snug text-slate-600">
                Nexus MedPro Staffing <span className="mx-0.5">–</span> Connecting Healthcare professionals with
                service providers
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:mt-10 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer w-full sm:w-auto px-6 py-2.5 border border-[#1db4a3] text-[#1db4a3] text-sm font-medium rounded-lg hover:bg-teal-50 transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSaveAndContinue}
              disabled={loading}
              className="cursor-pointer w-full sm:w-auto px-6 py-2.5 bg-[#1db4a3] hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save & continue"}
            </button>
          </div>
        </div>

        {/* RIGHT - Branding and Image */}
        <div className="relative hidden min-h-[320px] shrink-0 bg-gray-50 md:block md:min-h-0 md:w-[35%]">
          <div className="absolute inset-0 z-0">
            {/* You'll need to make sure the image path matches what you have or I can generate a placeholder */}
            <Image
              src="/images/nurse.jpg"
              alt="Healthcare professional smiling"
              fill
              sizes="(max-width: 767px) 0px, 35vw"
              className="object-cover object-top opacity-60 grayscale"
              priority
            />
            <div className="absolute inset-0 bg-white/65"></div>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-10">
            <div className="mb-6">
              <Image
                src="/images/new-logo-nexus.svg"
                alt="Nexus MedPro Logo"
                width={204}
                height={60}
                className="h-auto w-auto"
                priority
              />
            </div>

            <div className="w-full max-w-[280px]">
              <div className="mb-6 flex w-full items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-300/80" />
                <Image src="/icons/circle-star-icon.svg" alt="" width={24} height={24} className="h-6 w-6 flex-none" />
                <div className="h-px flex-1 bg-slate-300/80" />
              </div>
              <p
                className="text-[#1e293b]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '24px',
                  textAlign: 'center',
                }}
              >
                Nexus MedPro Staffing <span className="mx-0.5">–</span> Connecting Healthcare professionals with service providers
              </p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <OnboardingLoader
          overlay
          label="Saving your details..."
          backgroundClassName="bg-[#1db4a3]"
        />
      ) : null}

    </div>
  )
}

export default function Step1Review() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1db4a3]" />}>
      <Step1ReviewContent />
    </Suspense>
  )
}

