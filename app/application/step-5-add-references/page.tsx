"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { formatPhoneNumber, normalizePhoneInput } from "@/lib/phone"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import {
  hasPartiallyFilledReference,
  isReferenceComplete,
  MIN_COMPLETE_REFERENCES,
  type ReferenceRow,
} from "@/lib/referencesValidation"

type RefRow = ReferenceRow

function loadRefsFromStorage(): RefRow[] {
  if (typeof window === "undefined") return [{ first: "", last: "", phone: "", email: "" }]
  try {
    const draft = localStorage.getItem("referenceDataDraft")
    if (draft) {
      const p = JSON.parse(draft) as RefRow[]
      if (Array.isArray(p) && p.length) return p
    }
  } catch {
    /* ignore */
  }
  try {
    const saved = localStorage.getItem("referenceData")
    if (saved) {
      const p = JSON.parse(saved) as RefRow[]
      if (Array.isArray(p) && p.length) return p
    }
  } catch {
    /* ignore */
  }
  return [{ first: "", last: "", phone: "", email: "" }]
}

export default function ReferencesPage() {
  const router = useRouter()

  const [refs, setRefs] = useState<RefRow[]>(() => loadRefsFromStorage())
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle")

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setAutosaveState("saving")
        localStorage.setItem("referenceDataDraft", JSON.stringify(refs))
        setAutosaveState("saved")
        window.setTimeout(() => setAutosaveState("idle"), 1200)
      } catch {
        setAutosaveState("idle")
      }
    }, 650)
    return () => window.clearTimeout(t)
  }, [refs])

  function update(index: number, field: string, value: string) {
    const updated = [...refs]
    updated[index] = { ...updated[index], [field]: value }
    setRefs(updated)
  }

  function addReference() {
    if (refs.length >= 3) return
    setRefs([...refs, { first: "", last: "", phone: "", email: "" }])
  }

  async function saveReferences() {
    setError("")
    setSaving(true)
    if (hasPartiallyFilledReference(refs)) {
      setError("Finish every reference you started, or clear unused rows, before saving.")
      setSaving(false)
      return
    }
    const completeRefs = refs.filter(isReferenceComplete)
    const names = completeRefs
      .map((r) => `${r.first.trim()}-${r.last.trim()}`.toLowerCase())
      .filter((n) => n !== "-")
    if (new Set(names).size !== names.length) {
      setError("Duplicate reference names are not allowed.")
      setSaving(false)
      return
    }
    if (completeRefs.length < MIN_COMPLETE_REFERENCES) {
      setError(`Add at least ${MIN_COMPLETE_REFERENCES} complete references (first name, last name, phone, and email each) before continuing.`)
      setSaving(false)
      return
    }
    const applicantId = typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || "" : ""
    if (!applicantId) {
      setError("Missing applicant session. Return to Step 1 and save your profile.")
      setSaving(false)
      return
    }

    const res = await fetch("/api/onboarding/worker-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicantId,
        references: completeRefs.map((r) => ({
          first: r.first,
          last: r.last,
          phone: r.phone,
          email: r.email,
        })),
      }),
    })
    let payload: { error?: string; hint?: string } = {}
    try {
      payload = (await res.json()) as { error?: string; hint?: string }
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      setError(
        payload.hint
          ? `${payload.error || "Save failed"}. ${payload.hint}`
          : payload.error || `Save failed (${res.status})`,
      )
      setSaving(false)
      return
    }
    // router.push("/application/step-6-summary")
    localStorage.setItem("referenceData", JSON.stringify(completeRefs))
    localStorage.removeItem("referenceDataDraft")
    localStorage.setItem("referencesCount", String(completeRefs.length))
    localStorage.setItem("step5Completed", "false")
    router.push("/application/step-5-reference-review")
    setSaving(false)
  }

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/main-doctor.jpg"
       rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={5} completedThrough={4} />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">Add References</h2>
            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <AutosaveStatus
                state={
                  autosaveState === "saving" ? "saving" : autosaveState === "saved" ? "saved" : "idle"
                }
              />
            </div>
          </div>
          <p className="text-[13px] text-slate-500 mb-1">Trusted feedback, verified integrity.</p>
          <p className="text-[12px] text-slate-400 mb-6">
            Add at least {MIN_COMPLETE_REFERENCES} complete references (up to 3). Use + Add Reference for a third optional contact.
          </p>

          {/* References */}
          <div className="space-y-8">
            {refs.map((r, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-bold text-slate-800">Reference {index + 1}</p>
                  {index < MIN_COMPLETE_REFERENCES ? (
                    <p className="text-[11px] font-medium text-rose-600">Required</p>
                  ) : (
                    <p className="text-[11px] text-slate-400">Optional</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">First Name</label>
                    <input
                      value={r.first}
                      onChange={(e) => update(index, "first", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Last Name</label>
                    <input
                      value={r.last}
                      onChange={(e) => update(index, "last", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Phone</label>
                    <input
                      value={formatPhoneNumber(r.phone)}
                      onChange={(e) => update(index, "phone", normalizePhoneInput(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                      placeholder="(201) 555-5555"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Email</label>
                    <input
                      value={r.email}
                      onChange={(e) => update(index, "email", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Reference button */}
          {refs.length < 3 && (
            <button
              type="button"
              onClick={addReference}
              className="mt-6 w-fit rounded-md border border-[#0D9488] px-4 py-1.5 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              + Add Reference
            </button>
          )}

          {error && <p className="mt-4 text-[12px] text-red-500">{error}</p>}

          {/* Buttons */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={saveReferences}
              disabled={saving}
              className="cursor-pointer rounded-md bg-[#0D9488] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#0b7a70] disabled:cursor-not-allowed disabled:opacity-70"
            >
              Save &amp; continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
