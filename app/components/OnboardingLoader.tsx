"use client"

import type { CSSProperties } from "react"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import { brandingShellGradient, hexToRgba } from "@/lib/tenant/tenant-branding"

type OnboardingLoaderProps = {
  label?: string
  overlay?: boolean
  backgroundClassName?: string
  backgroundStyle?: CSSProperties
}

export default function OnboardingLoader({
  label = "Loading, please wait...",
  overlay = false,
  backgroundClassName,
  backgroundStyle,
}: OnboardingLoaderProps) {
  const branding = useTenantBranding()
  const shellStyle: CSSProperties = backgroundStyle ?? {
    background: brandingShellGradient(branding),
  }
  const spinnerStyle: CSSProperties = {
    borderColor: hexToRgba(branding.primaryHex, 0.35),
    borderTopColor: branding.primaryHex,
  }

  return (
    <div
      className={
        overlay
          ? "fixed inset-0 z-[120] flex items-center justify-center p-6"
          : `flex min-h-screen items-center justify-center p-6 ${backgroundClassName ?? ""}`
      }
      style={overlay ? undefined : shellStyle}
    >
      {overlay ? (
        <div className={`absolute inset-0 opacity-90 ${backgroundClassName ?? ""}`} style={shellStyle} />
      ) : null}

      <div className="relative z-10 flex min-w-[260px] flex-col items-center gap-4 rounded-2xl bg-white/95 px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
        <div className="h-11 w-11 animate-spin rounded-full border-4" style={spinnerStyle} />
        <p className="text-center text-[15px] font-semibold leading-6 text-slate-800">
          {label}
        </p>
      </div>
    </div>
  )
}
