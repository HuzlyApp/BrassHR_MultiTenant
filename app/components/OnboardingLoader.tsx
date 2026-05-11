"use client"

type OnboardingLoaderProps = {
  label?: string
  overlay?: boolean
  backgroundClassName?: string
}

export default function OnboardingLoader({
  label = "Loading, please wait...",
  overlay = false,
  backgroundClassName = "bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)]",
}: OnboardingLoaderProps) {
  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-[120] flex items-center justify-center p-6"
          : `flex min-h-screen items-center justify-center ${backgroundClassName} p-6`
      }
    >
      {overlay ? (
        <div className={`absolute inset-0 ${backgroundClassName} opacity-90`} />
      ) : null}

      <div className="relative z-10 flex min-w-[260px] flex-col items-center gap-4 rounded-2xl bg-white/95 px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#99f6e4] border-t-[#0D9488]" />
        <p className="text-center text-[15px] font-semibold leading-6 text-slate-800">
          {label}
        </p>
      </div>
    </div>
  )
}
