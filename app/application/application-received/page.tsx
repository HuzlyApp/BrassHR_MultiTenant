"use client"

import type { CSSProperties } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingShellGradient,
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
} from "@/lib/tenant/tenant-branding"

export default function ApplicationReceivedPage() {
  const branding = useTenantBranding()
  const router = useRouter()

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
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  return (
    <div
      style={shellStyle}
      className="flex min-h-screen items-center justify-center p-6 md:p-12"
    >
      <div className="flex w-full max-w-[900px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-1 flex-col justify-center p-8 md:p-10">
          <h1 className="mb-2 text-xl font-semibold text-gray-900 md:text-2xl">
            Application Received
          </h1>
          <p className="mb-8 max-w-[420px] text-sm text-gray-600">
            We&apos;ll contact you within 1–3 business days. Thanks for completing your application.
          </p>

          <div>
            <button
              type="button"
              onClick={() => router.push("/admin_recruiter/dashboard")}
              className="rounded-lg px-6 py-2.5 font-medium text-white transition hover:brightness-90"
              style={primaryBtnStyle}
            >
              Go to Dashboard
            </button>
          </div>
        </div>

        <div className="relative hidden w-[360px] md:block">
          {panelUseNativeImg ? (
            <img
              src={panelSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale"
            />
          ) : (
            <Image
              src={panelSrc}
              alt=""
              fill
              className="object-cover opacity-60 grayscale"
              priority
            />
          )}
          <div className="absolute inset-0 bg-white/65" />
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            {logoUseNativeImg ? (
              <img
                src={logoSrc}
                alt={branding.companyName}
                className="mb-4 h-auto w-40 max-w-full object-contain"
              />
            ) : (
              <Image
                src={logoSrc}
                alt={branding.companyName}
                width={160}
                height={56}
                className="mb-4 h-auto w-40"
                priority
              />
            )}
            <p className="text-sm text-gray-700">{branding.tagline}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
