
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Pencil, ChevronRight } from "lucide-react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import {
  countCompleteReferences,
  MIN_COMPLETE_REFERENCES,
  type ReferenceRow,
} from "@/lib/referencesValidation"

type Reference = ReferenceRow

const emptyReference: Reference = {
  first: "",
  last: "",
  phone: "",
  email: "",
}

export default function ReferenceReviewPage() {
  const router = useRouter()
  const [references, setReferences] = useState<Reference[]>([])
  const [continueError, setContinueError] = useState<string | null>(null)

  useEffect(() => {
    const data = localStorage.getItem("referenceData")
    if (data) {
      try {
        const parsed = JSON.parse(data) as Reference[]
        setReferences(Array.isArray(parsed) ? parsed : [])
      } catch {
        setReferences([])
      }
    }
  }, [])

  const slots = useMemo(() => {
    const filled = references.slice(0, 3)
    while (filled.length < 3) {
      filled.push(emptyReference)
    }
    return filled
  }, [references])

  const completeCount = countCompleteReferences(references)
  const hasAnyReference = references.length > 0
  const hasMinimumReferences = completeCount >= MIN_COMPLETE_REFERENCES

  const handleEdit = () => {
    router.push("/application/step-5-add-references")
  }

  const handleContinue = () => {
    setContinueError(null)
    if (!hasMinimumReferences) {
      setContinueError(
        `Add at least ${MIN_COMPLETE_REFERENCES} complete references before continuing to the summary.`,
      )
      return
    }
    localStorage.setItem("step5Completed", "true")
    router.push("/application/step-6-summary")
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-[26px] font-semibold leading-9 text-slate-800">References</h2>
              </div>
              <p className="mt-2 max-w-2xl text-[13px] text-slate-500">
                Review the references you added. You need at least {MIN_COMPLETE_REFERENCES} complete references before
                the summary. Use the edit button to update any contact details.
              </p>
            </div>
          </div>

          {!hasAnyReference ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <p className="text-[15px] font-semibold text-slate-800 mb-2">No references added yet</p>
              <p className="text-sm text-slate-500 mb-6">
                Add at least {MIN_COMPLETE_REFERENCES} references with full contact details so we can verify your
                background.
              </p>
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center gap-2 rounded-lg border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
              >
                Add References
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {slots.map((reference, index) => {
                const isFilled = Boolean(reference.first || reference.last || reference.phone || reference.email)
                return (
                  <div key={index} className="rounded-2xl border border-[#0D9488] bg-white p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-slate-900">Reference {index + 1}</p>
                          {index < MIN_COMPLETE_REFERENCES ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              Required
                            </span>
                          ) : (
                            <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-slate-500 mt-1">
                          {isFilled ? "Verified contact details" : "Not added yet"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleEdit}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    </div>

                    {isFilled ? (
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">First Name</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{reference.first}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Last Name</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{reference.last}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Phone</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{reference.phone}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Email</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{reference.email}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                        Reference {index + 1} has not been added. Tap edit to complete it.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {continueError ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {continueError}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-[#0D9488] bg-white px-6 py-2 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={!hasMinimumReferences}
              className="rounded-xl bg-[#0D9488] px-6 py-2 text-[12px] font-medium text-white transition hover:bg-[#0b7a70] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}