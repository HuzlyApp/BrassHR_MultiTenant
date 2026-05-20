"use client";

import type { ReactNode } from "react";
import TenantOnboardingStepper, {
  tenantOnboardingStepToPhase,
  type TenantOnboardingStepperPhase,
} from "@/app/components/TenantOnboardingStepper";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, type TenantBranding } from "@/lib/tenant/tenant-branding";

export const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

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
}: TenantOnboardingShellProps) {
  const phase = stepperPhase ?? tenantOnboardingStepToPhase(step);

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        className="min-h-screen w-full bg-white"
        style={brandingToCssVars(brand) as React.CSSProperties}
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
              Welcome to {brand.companyName}!
            </h1>
            <p
              className="mt-[6px] text-[16px] font-normal leading-[24px] text-[#0f172a]"
              style={interStyle}
            >
              Get started by following these 4 easy steps.
            </p>

            {!hideStepper ? <TenantOnboardingStepper phase={phase} className="w-full" /> : null}
          </div>

          <div className="mt-[28px] w-full">{children}</div>
        </div>
      </main>
    </TenantBrandingProvider>
  );
}
