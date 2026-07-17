"use client";

import Image from "next/image";
import { useLayoutEffect, type ReactNode } from "react";
import TenantOnboardingStepper, {
  tenantOnboardingStepToPhase,
  type TenantOnboardingStepperPhase,
} from "@/app/components/TenantOnboardingStepper";
import type { TenantStepIndicatorState } from "@/lib/tenant/tenant-onboarding-stepper-status";
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
  /** Check vs warning icons from form completion */
  stepperStates?: TenantStepIndicatorState[];
  /** Advance to the next step without filling the form */
  onSkip?: () => void;
};

export function primaryButtonStyle(enabled: boolean): React.CSSProperties | undefined {
  if (!enabled) return undefined;
  return {
    backgroundImage: "linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-accent) 100%)",
    fontFamily: "var(--font-geist-sans), Inter, Arial, sans-serif",
    color: "#ffffff",
  };
}

export default function TenantOnboardingShell({
  brand,
  step,
  children,
  hideStepper = false,
  stepperPhase,
  stepperStates,
  onSkip,
}: TenantOnboardingShellProps) {
  const phase = stepperPhase ?? tenantOnboardingStepToPhase(step);
  const showSkip = Boolean(onSkip) && step !== "done" && step !== "admin";

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        className="tenant-onboarding-light min-h-screen w-full bg-white text-[#0f172a]"
        style={{ ...(brandingToCssVars(brand) as React.CSSProperties), colorScheme: "light only" }}
      >
        <div className="mx-auto flex min-h-[1116px] w-full max-w-[620px] flex-col items-center px-4 py-[20px]">
          <div className="flex w-full flex-col items-center text-center">
            <div className="relative flex h-[72px] w-[220px] items-center justify-center max-[399px]:h-[58px] max-[399px]:w-[176px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="max-h-[72px] max-w-[220px] object-contain max-[399px]:max-h-[58px] max-[399px]:max-w-[176px]"
              />
            </div>

            <h1
              className="mt-[18px] text-[34px] font-semibold leading-[40px] tracking-normal max-[399px]:mt-[14px] max-[399px]:text-[26px] max-[399px]:leading-[32px]"
              style={{ ...interStyle, color: "var(--brand-primary)" }}
            >
              Welcome to Brass HR!
            </h1>
            <p className="mt-[6px] w-full text-[18px] font-semibold leading-[28px] tracking-normal text-[#0f172a]" style={shellSubtitleStyle}>
              Get started by following these 4 easy steps.
            </p>

            {!hideStepper ? (
              <TenantOnboardingStepper phase={phase} stepStates={stepperStates} className="w-full" />
            ) : null}
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
