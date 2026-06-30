"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import TenantOnboardingStepper, {
  tenantOnboardingStepToPhase,
  type TenantOnboardingStepperPhase,
} from "@/app/components/TenantOnboardingStepper";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, type TenantBranding } from "@/lib/tenant/tenant-branding";

export const interStyle = {
  fontFamily: "var(--font-tenant-branding-inter), Inter, Arial, sans-serif",
};

/** Shell subtitle — "Get started by following these 4 easy steps." */
export const shellSubtitleStyle: React.CSSProperties = {
  ...interStyle,
  fontWeight: 600,
  fontSize: "18px",
  lineHeight: "28px",
  letterSpacing: "0",
  textAlign: "center",
};

/** Figma: fontFamilies/secondary, fontSize/xsm, lineHeights/sm, letterSpacing/md */
export const skipForNowButtonStyle: React.CSSProperties = {
  fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
  fontWeight: 600,
  fontSize: "12px",
  lineHeight: "16px",
  letterSpacing: "0.02em",
  verticalAlign: "middle",
  color: "#104b83",
};

function SkipForNowButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="my-[36px] flex w-full items-center justify-end">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex cursor-pointer items-center gap-[6px] transition hover:text-[#0b3a70]"
        style={skipForNowButtonStyle}
      >
        Skip for Now
        <Image src="/icons/braas-HR/skip.svg" alt="" width={5} height={8} aria-hidden />
      </button>
    </div>
  );
}

type TenantOnboardingShellProps = {
  brand: TenantBranding;
  step:
    | "goals"
    | "business"
    | "company_logo"
    | "branding"
    | "domain"
    | "onboarding"
    | "preview"
    | "admin"
    | "done";
  children: ReactNode;
  /** Hide stepper on success screen */
  hideStepper?: boolean;
  /** Override stepper phase (e.g. extended setup steps) */
  stepperPhase?: TenantOnboardingStepperPhase;
  /** Advance to the next step without filling the form */
  onSkip?: () => void;
};

export function primaryButtonStyle(enabled: boolean): React.CSSProperties | undefined {
  if (!enabled) return undefined;
  return {
    backgroundImage: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
    fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
  };
}

export default function TenantOnboardingShell({
  brand,
  step,
  children,
  hideStepper = false,
  stepperPhase,
  onSkip,
}: TenantOnboardingShellProps) {
  const phase = stepperPhase ?? tenantOnboardingStepToPhase(step);
  const showSkip = Boolean(onSkip) && step !== "done" && step !== "admin";

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        className="tenant-onboarding-light min-h-screen w-full bg-white text-[#0f172a]"
        style={{ ...(brandingToCssVars(brand) as React.CSSProperties), colorScheme: "light only" }}
      >
        <div className="mx-auto flex min-h-[1116px] w-full max-w-[620px] flex-col items-center px-4 py-[20px]">
          <div className="flex w-full flex-col items-center text-center">
            <div className="relative flex h-[72px] w-[220px] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="max-h-[72px] max-w-[220px] object-contain"
              />
            </div>

            <h1
              className="mt-[18px] text-[34px] font-semibold leading-[40px] tracking-normal"
              style={{ ...interStyle, color: "var(--brand-primary)" }}
            >
              Welcome to Brass HR!
            </h1>
            <p className="mt-[6px] w-full text-[18px] font-semibold leading-[28px] tracking-normal text-[#0f172a]" style={shellSubtitleStyle}>
              Get started by following these 4 easy steps.
            </p>

            {!hideStepper ? <TenantOnboardingStepper phase={phase} className="w-full" /> : null}
            {showSkip ? <SkipForNowButton onClick={onSkip!} /> : null}
          </div>

          <div className={`w-full ${hideStepper ? "mt-[32px]" : showSkip ? "mt-0" : "mt-[58px]"}`}>
            {children}
          </div>
        </div>
      </main>
    </TenantBrandingProvider>
  );
}
