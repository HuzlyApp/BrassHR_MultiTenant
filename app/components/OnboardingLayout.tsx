"use client"

import type { CSSProperties } from "react"
import Image from "next/image"
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon"
import BrandingRightPanelLogo, {
  BRANDING_PANEL_LOGO_WIDTH_CLASS,
  BRANDING_RIGHT_PANEL_STACK_GAP_CLASS,
} from "@/app/components/BrandingRightPanelLogo"
import { cn } from "@/lib/cn"
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext"
import {
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
  tenantApplicantPanelLogoUrl,
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
    tenantApplicantPanelLogoUrl(branding),
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
      className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-hidden p-4 sm:p-6 lg:p-8"
    >
      <div
        className={cn(
          // Fluid columns so the right panel never clips when card max-width < 730+330.
          "h-full w-full min-w-0 max-w-[1060px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] min-[700px]:grid min-[700px]:min-h-[540px] min-[700px]:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)] min-[1200px]:min-h-[650px] min-[1200px]:grid-cols-[minmax(0,2.2fr)_minmax(220px,1fr)]",
          cardClassName
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-b border-slate-200 min-[700px]:border-b-0 min-[700px]:border-r min-[700px]:border-slate-200">
          {children}
        </div>

        <div
          className={cn(
            "relative hidden min-h-0 min-w-0 overflow-hidden rounded-b-2xl min-[700px]:block min-[700px]:rounded-b-none min-[700px]:rounded-r-2xl",
            rightPanelClassName
          )}
        >
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
              sizes="(max-width: 699px) 0px, 33vw"
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
              "absolute inset-0 flex items-center justify-center overflow-hidden p-4 pt-[calc(1.5rem+10%)] min-[900px]:p-6 min-[900px]:pt-[calc(2rem+12%)] min-[1200px]:p-8",
              rightPanelContentClassName
            )}
          >
            <div
              className={cn(
                "flex w-full max-w-[270px] min-w-0 flex-col items-center text-center",
                BRANDING_RIGHT_PANEL_STACK_GAP_CLASS,
                rightPanelInnerClassName
              )}
            >
              <BrandingRightPanelLogo
                src={logoSrc}
                alt=""
                widthClassName={BRANDING_PANEL_LOGO_WIDTH_CLASS}
                className={logoClassName}
              />

              <div className="flex w-full min-w-0 items-center justify-center gap-4">
                <div className="h-px min-w-0 flex-1 bg-slate-400/55" />
                <BrandedSvgIcon
                  src="/icons/circle-star-icon.svg"
                  className="h-6 w-6 flex-none"
                  color={branding.primaryHex}
                />
                <div className="h-px min-w-0 flex-1 bg-slate-400/55" />
              </div>

              <p
                className={cn(
                  "w-full break-words text-center text-[14px] font-normal leading-5 tracking-normal text-black min-[900px]:text-[16px] min-[900px]:leading-6",
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
