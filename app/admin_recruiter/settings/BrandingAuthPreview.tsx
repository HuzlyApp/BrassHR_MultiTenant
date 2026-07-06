"use client";

import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import {
  brandingAuthButtonStyle,
  brandingToCssVars,
  normalizeBrandingImageSrc,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

type PreviewMode = "login" | "signup";

type BrandingAuthPreviewProps = {
  branding: TenantBranding;
  mode: PreviewMode;
};

const SIGNUP_STEP_LABELS = ["Sign Up", "Preparing your trial", "Account is ready"] as const;

function PreviewField({ label }: { label: string }) {
  return (
    <div>
      <span className="mb-1 block text-[10px] font-normal leading-tight text-[#0f172a]">{label}</span>
      <div className="h-8 w-full rounded-[5px] border border-[#d7e0ea] bg-white" aria-hidden />
    </div>
  );
}

function PreviewRightPanel({
  backgroundSrc,
  logoSrc,
  tagline,
  primaryHex,
}: {
  backgroundSrc: string;
  logoSrc: string;
  tagline: string;
  primaryHex: string;
}) {
  const panelSrc = normalizeBrandingImageSrc(backgroundSrc, "/images/handshake.jpg", { allowBlob: true });
  const logo = normalizeBrandingImageSrc(logoSrc, "/images/new-logo-nexus.svg", { allowBlob: true });

  return (
    <div className="relative hidden min-h-[260px] overflow-hidden sm:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={panelSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 grayscale" />
      <div className="absolute inset-0 bg-white/65" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="flex w-full max-w-[130px] flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="max-h-10 max-w-full object-contain" />
          <div className="flex w-full items-center justify-center gap-2">
            <div className="h-px flex-1 bg-slate-400/55" />
            <BrandedSvgIcon src="/icons/circle-star-icon.svg" className="h-3.5 w-3.5 flex-none" color={primaryHex} />
            <div className="h-px flex-1 bg-slate-400/55" />
          </div>
          <p className="line-clamp-3 text-[9px] leading-snug text-black">{tagline}</p>
        </div>
      </div>
    </div>
  );
}

function PreviewSignupStepper({ primaryHex }: { primaryHex: string }) {
  return (
    <div className="mt-4 w-full">
      <div className="relative h-10 w-full">
        <div
          className="absolute left-[14px] right-[14px] top-[6px] h-[2px] bg-[#e8edf4]"
          aria-hidden
        />
        <div
          className="absolute left-[14px] top-[6px] h-[2px] w-[22%]"
          style={{ backgroundColor: primaryHex }}
          aria-hidden
        />
        <div className="relative flex items-start justify-between">
          {SIGNUP_STEP_LABELS.map((label, index) => {
            const isActive = index === 0;
            const isPending = index > 0;

            return (
              <div key={label} className="flex w-[30%] flex-col items-center">
                <span
                  className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full border bg-white"
                  style={{
                    borderColor: isPending ? "#e8edf4" : primaryHex,
                    backgroundColor: isPending ? "#ffffff" : primaryHex,
                    color: "#ffffff",
                  }}
                >
                  {isActive ? <Check className="h-2.5 w-2.5" strokeWidth={2.5} /> : null}
                  {isPending ? <span className="h-1 w-1 rounded-full bg-[#e8edf4]" /> : null}
                </span>
                <span
                  className="mt-1.5 line-clamp-2 text-center text-[7px] leading-tight"
                  style={{ color: isPending ? "#94a3b8" : "#0f172a" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LoginPreview({ branding }: { branding: TenantBranding }) {
  const shellStyle = brandingToCssVars(branding) as CSSProperties;
  const buttonStyle = brandingAuthButtonStyle(true);

  return (
    <div
      className="rounded-xl p-3"
      style={{
        ...shellStyle,
        background: `linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)`,
      }}
    >
      <div className="grid overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:grid-cols-[58%_42%]">
        <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r">
          <div className="mb-2 h-0.5 w-6 rounded-full" style={{ backgroundColor: "var(--brand-primary)" }} />
          <h2
            className="text-sm font-bold leading-tight"
            style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
          >
            {branding.headline}
          </h2>

          <div className="mt-3 space-y-2.5">
            <PreviewField label="Email" />
            <PreviewField label="Password" />
          </div>

          <div className="mt-2 flex justify-end">
            <span className="text-[8px] font-medium" style={{ color: "var(--brand-primary)" }}>
              Forgot Password?
            </span>
          </div>

          <div className="mt-2 flex items-start gap-1.5">
            <span className="mt-0.5 h-3 w-3 shrink-0 rounded border border-gray-300 bg-white" aria-hidden />
            <span className="text-[8px] leading-tight text-gray-600">Terms &amp; Conditions</span>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-md border border-gray-300 py-1.5 text-center text-[9px] font-medium text-gray-700">
              Cancel
            </div>
            <div
              className="flex-1 rounded-md py-1.5 text-center text-[9px] font-medium text-white"
              style={buttonStyle}
            >
              {branding.buttonText}
            </div>
          </div>
        </div>

        <PreviewRightPanel
          backgroundSrc={branding.loginBackgroundSrc}
          logoSrc={branding.loginLogoUrl || branding.logoUrl}
          tagline={branding.tagline}
          primaryHex={branding.primaryHex}
        />
      </div>
    </div>
  );
}

function SignupPreview({ branding }: { branding: TenantBranding }) {
  const shellStyle = brandingToCssVars(branding) as CSSProperties;
  const buttonStyle = brandingAuthButtonStyle(true);
  const signupLogo = normalizeBrandingImageSrc(
    branding.signupLogoUrl || branding.logoUrl,
    "/images/new-logo-nexus.svg",
    { allowBlob: true }
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white" style={shellStyle}>
      <div className="grid items-stretch sm:grid-cols-[56%_44%]">
        <div className="flex flex-col p-5 pb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signupLogo} alt="" className="h-6 w-auto max-w-[88px] object-contain object-left" />

          <PreviewSignupStepper primaryHex={branding.primaryHex} />

          <div className="mt-5">
            <h2
              className="text-[15px] font-semibold leading-tight"
              style={{ color: "var(--brand-heading)", fontFamily: "var(--brand-font-heading)" }}
            >
              {branding.signupHeadline}
            </h2>
            <p
              className="mt-1.5 text-[10px] leading-snug"
              style={{ color: "var(--brand-muted)", fontFamily: "var(--brand-font-body)" }}
            >
              {branding.signupSubheadline}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <PreviewField label="First Name" />
            <PreviewField label="Last Name" />
          </div>

          <div className="mt-5 flex-1" />

          <div
            className="mt-4 flex h-9 w-full shrink-0 items-center justify-center rounded-[6px] text-[11px] font-semibold text-white"
            style={buttonStyle}
          >
            Next
          </div>
        </div>

        <PreviewRightPanel
          backgroundSrc={branding.loginBackgroundSrc}
          logoSrc={branding.loginLogoUrl || branding.logoUrl}
          tagline={branding.tagline}
          primaryHex={branding.primaryHex}
        />
      </div>
    </div>
  );
}

export default function BrandingAuthPreview({ branding, mode }: BrandingAuthPreviewProps) {
  return (
    <div className="pointer-events-none select-none" aria-hidden>
      {mode === "login" ? <LoginPreview branding={branding} /> : <SignupPreview branding={branding} />}
    </div>
  );
}
