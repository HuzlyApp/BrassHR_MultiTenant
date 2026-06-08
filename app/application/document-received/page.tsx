"use client"

import type { CSSProperties } from "react"
import Image from "next/image"
import { Check } from "lucide-react"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingShellGradient,
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
} from "@/lib/tenant/tenant-branding"

export default function DocumentReceivedPage() {
  const branding = useTenantBranding()

  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: brandingShellGradient(branding),
  }
  const panelSrc = normalizeBrandingImageSrc(branding.loginBackgroundSrc, "/images/handshake.jpg")
  const logoSrc = normalizeBrandingImageSrc(branding.logoUrl, "/images/new-logo-nexus.svg", {
    allowBlob: true,
  })
  const panelUseNativeImg = isRemoteOrBlobImageSrc(panelSrc)
  const logoUseNativeImg = isRemoteOrBlobImageSrc(logoSrc)
  const checkCircleStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  return (
    <div
      style={shellStyle}
      className="flex min-h-screen items-center justify-center p-6 md:p-12"
    >
      <div className="h-[500px] w-full max-w-[840px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex h-full w-full">
          <div className="flex h-[500px] w-[510px] flex-col items-center justify-center px-10 pb-10 pt-[56px] text-center">
            <div className="mb-auto mt-auto flex flex-col items-center gap-[36px]">
              <div
                className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full text-white shadow-sm"
                style={checkCircleStyle}
              >
                <Check className="h-8 w-8" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-slate-900">
                  Document Received
                </h1>
                <p className="mx-auto mt-4 max-w-[340px] text-[16px] leading-[26px] text-slate-600">
                  We&apos;ll contact you within 1–3 business days and please check your email for the
                  latest update.
                </p>
              </div>
            </div>
          </div>

          <div className="relative hidden h-[500px] w-[330px] flex-col items-center justify-center gap-[24px] overflow-hidden bg-white p-[20px] md:flex">
            {panelUseNativeImg ? (
              <img
                src={panelSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover bg-white/65 opacity-60 grayscale"
              />
            ) : (
              <Image
                src={panelSrc}
                alt=""
                fill
                className="object-cover bg-white/65 opacity-60 grayscale"
                priority
              />
            )}
            <div className="absolute inset-0 bg-white/65" />
            <div className="relative flex w-full flex-col items-center justify-center gap-[24px] text-center">
              <div className="relative h-16 w-44">
                {logoUseNativeImg ? (
                  <img
                    src={logoSrc}
                    alt={branding.companyName}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={branding.companyName}
                    fill
                    className="object-contain"
                    priority
                  />
                )}
              </div>
              <div className="flex w-full items-center justify-center gap-3">
                <div className="h-px flex-1 bg-slate-300/70" />
                <Image
                  src="/icons/circle-star-icon.svg"
                  alt=""
                  width={24}
                  height={24}
                  className="object-contain"
                />
                <div className="h-px flex-1 bg-slate-300/70" />
              </div>
              <p className="max-w-[240px] text-[14px] leading-6 text-slate-700">
                {branding.tagline}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
