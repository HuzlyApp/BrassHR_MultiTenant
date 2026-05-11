"use client"

import { Check } from "lucide-react"

type OnboardingSuccessPopupProps = {
  open: boolean
  title?: string
  message?: string
  buttonLabel?: string
  onContinue: () => void
}

export default function OnboardingSuccessPopup({
  open,
  title = "Saved Successfully!",
  message = "Your information has been saved.",
  buttonLabel = "Continue to Next Step",
  onContinue,
}: OnboardingSuccessPopupProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 animate-in fade-in duration-300">
      <div className="mx-4 flex min-h-[380px] w-[95%] max-w-[520px] transform flex-col items-center justify-center rounded-[20px] bg-white p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-300 md:h-[400px] md:p-10">
        <div className="mb-6 flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-[#28c7bf] text-white shadow-sm">
          <Check className="h-8 w-8" strokeWidth={2.5} />
        </div>

        <h3 className="mb-3 text-[28px] font-bold tracking-tight text-slate-900 md:text-[32px]">
          {title}
        </h3>

        <p className="mb-8 max-w-[340px] text-[16px] leading-relaxed text-slate-600 md:mb-10 md:text-[18px]">
          {message}
        </p>

        <button
          onClick={onContinue}
          className="cursor-pointer h-14 w-full max-w-[360px] rounded-xl bg-[#28C7BF] text-[18px] font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#23B5AD] hover:shadow-xl active:translate-y-0"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
