"use client"

import type { CSSProperties } from "react"
import { useEffect, useRef } from "react"
import { applicationPath } from "@/lib/tenant/with-tenant"
import { sendApplicationSubmissionEmail } from "@/lib/onboarding/send-application-submission-email"
import Image from "next/image"
import Link from "next/link"
import { Check } from "lucide-react"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingShellGradient,
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
  tenantApplicantPanelLogoUrl,
} from "@/lib/tenant/tenant-branding"

export default function SuccessPage() {
  const branding = useTenantBranding()
  const emailSentRef = useRef(false)

  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: brandingShellGradient(branding),
  }
  const panelSrc = normalizeBrandingImageSrc(branding.loginBackgroundSrc, "/images/handshake.jpg")
  const logoSrc = normalizeBrandingImageSrc(tenantApplicantPanelLogoUrl(branding), "/images/new-logo-nexus.svg", {
    allowBlob: true,
  })
  const panelUseNativeImg = isRemoteOrBlobImageSrc(panelSrc)
  const logoUseNativeImg = isRemoteOrBlobImageSrc(logoSrc)
  const checkCircleStyle = { backgroundColor: branding.primaryHex } as CSSProperties
  const primaryBtnStyle = { backgroundColor: branding.primaryHex } as CSSProperties

  useEffect(() => {
    if (emailSentRef.current) return
    const applicantId = localStorage.getItem("applicantId")?.trim()
    if (!applicantId) return
    emailSentRef.current = true

    void fetch("/api/onboarding/continuation-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    }).catch(() => {
      /* best-effort tracking only */
    })

    void sendApplicationSubmissionEmail(applicantId).catch(() => {
      /* best-effort; applicant still sees success UI */
    })
  }, [])

  return (
    <div
      style={shellStyle}
      className="flex min-h-screen items-center justify-center p-4 sm:p-6 md:p-12"
    >
      <div className="w-full max-w-[840px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)] sm:h-[500px] sm:min-h-[500px]">
        <div className="flex h-full min-h-0 flex-col sm:flex-row">
          <div className="flex w-full flex-col items-center justify-center px-4 pb-8 pt-10 text-center sm:px-10 sm:pb-10 sm:pt-[56px] md:w-[510px]">
            <div
              className="mb-5 flex h-14 w-14 flex-none items-center justify-center rounded-full text-white shadow-sm sm:mb-6 sm:h-[72px] sm:w-[72px]"
              style={checkCircleStyle}
            >
              <Check className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
            </div>
            <div className="mx-auto w-full max-w-[420px] space-y-4 sm:space-y-6">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-900 sm:text-[32px]">
                  Application Received
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-[15px] sm:leading-7">
                  We&apos;ll contact you within 1–3 business days.
                  <br />
                  Please check your email for the latest update.
                </p>
              </div>
            </div>

            <Link
              href={applicationPath("/application/application-status")}
              className="mt-8 inline-flex w-full max-w-[320px] items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:brightness-90 sm:mt-10 sm:w-auto sm:px-8 sm:text-[14px]"
              style={primaryBtnStyle}
            >
              Check Status
            </Link>
          </div>

          <div className="relative hidden h-[500px] w-[330px] flex-col items-center justify-center gap-[24px] overflow-hidden bg-white p-[20px] md:flex">
            {panelUseNativeImg ? (
              <img
                src={panelSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center bg-white/60 opacity-60 grayscale"
              />
            ) : (
              <Image
                src={panelSrc}
                alt=""
                fill
                className="object-cover object-center bg-white/60 opacity-60 grayscale"
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
                <BrandedSvgIcon
                  src="/icons/circle-star-icon.svg"
                  className="h-6 w-6 flex-none object-contain"
                  color={branding.primaryHex}
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
