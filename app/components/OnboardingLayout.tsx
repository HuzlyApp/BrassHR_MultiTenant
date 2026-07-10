"use client"

import type { CSSProperties } from "react"
import Image from "next/image"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import BrandingRightPanelLogo, {
  BRANDING_PANEL_LOGO_WIDTH_CLASS,
} from "@/app/components/BrandingRightPanelLogo"
import { cn } from "@/lib/cn"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
} from "@/lib/tenant/tenant-branding"

type Props = {
  children: React.ReactNode
  cardClassName?: string
  rightPanelClassName?: string
  rightPanelContentClassName?: string
  rightPanelInnerClassName?: string
  logoClassName?: string
  taglineClassName?: string
  rightPanelImageSrc?: string
  rightPanelImageAlt?: string
  rightPanelImageClassName?: string
  rightPanelOverlayClassName?: string
}

export default function OnboardingLayout({
  children,
  cardClassName,
  rightPanelClassName,
  rightPanelContentClassName,
  rightPanelInnerClassName,
  logoClassName,
  taglineClassName,
  rightPanelImageSrc,
  rightPanelImageAlt,
  rightPanelImageClassName,
  rightPanelOverlayClassName
}: Props) {
  const branding = useTenantBranding()
  const panelSrc = normalizeBrandingImageSrc(
    rightPanelImageSrc ?? branding.loginBackgroundSrc,
    "/images/handshake.jpg"
  )
  const panelUseNativeImg = isRemoteOrBlobImageSrc(panelSrc)
  const logoSrc = normalizeBrandingImageSrc(
    branding.loginLogoUrl || branding.logoUrl,
    "/images/new-logo-nexus.svg",
    { allowBlob: true }
  )
  const shellStyle: CSSProperties = {
    ...brandingToCssVars(branding),
    background: `linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)`,
  }

  return (
    <div
      style={shellStyle}
      className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8"
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:grid md:min-h-[650px] md:min-w-[1060px] md:max-w-[1060px] md:grid-cols-[730px_330px] h-full",
          cardClassName
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-b border-slate-200 md:border-b-0 md:border-r md:border-slate-200">
          {children}
        </div>

        <div className={cn("relative hidden overflow-visible md:block", rightPanelClassName)}>
          {panelUseNativeImg ? (
            <img
              src={panelSrc}
              alt={rightPanelImageAlt ?? "Applicant onboarding"}
              className={cn(
                "absolute inset-0 h-full w-full object-cover grayscale opacity-60",
                rightPanelImageClassName
              )}
            />
          ) : (
            <Image
              src={panelSrc}
              alt={rightPanelImageAlt ?? "Applicant onboarding"}
              fill
              sizes="(max-width: 767px) 0px, 330px"
              className={cn("object-cover grayscale opacity-60", rightPanelImageClassName)}
              priority
            />
          )}
          <div
            className={cn(
              "absolute inset-0 bg-white/65",
              rightPanelOverlayClassName
            )}
          />

          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-visible p-8",
              rightPanelContentClassName
            )}
          >
            <div
              className={cn(
                "flex w-full max-w-[270px] flex-col items-center gap-6 text-center",
                rightPanelInnerClassName
              )}
            >
              <BrandingRightPanelLogo
                src={logoSrc}
                alt=""
                widthClassName={BRANDING_PANEL_LOGO_WIDTH_CLASS}
                className={logoClassName}
              />

              <div className="flex w-full items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-400/55" />
                <BrandedSvgIcon
                  src="/icons/circle-star-icon.svg"
                  className="h-6 w-6 flex-none"
                  color={branding.primaryHex}
                />
                <div className="h-px flex-1 bg-slate-400/55" />
              </div>

              <p
                className={cn(
                  "text-center text-[16px] font-normal leading-6 tracking-normal text-black",
                  taglineClassName
                )}
              >
                {branding.tagline}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
