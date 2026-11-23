"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import OnboardingLayout from "@/app/components/OnboardingLayout";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";

const TITLE = "Thanks — your application has been submitted.";
const MESSAGE =
  "You don't need to do anything else right now. If we decide to move forward, we'll be in touch.";
const SEARCH_MORE_JOBS_HREF = "https://zipstaff.com/search-apply/";

/**
 * In-place replacement for the applicant left panel when the next step is recruiter-owned.
 * Keeps the same onboarding shell so candidates are not returned to an editable form.
 */
export default function AwaitingRecruiterReviewScreen() {
  const branding = useTenantBranding();
  const buttonBackground = useMemo(
    () =>
      `linear-gradient(90deg, ${branding.primaryHex} 0%, color-mix(in srgb, ${branding.primaryHex} 70%, white) 100%)`,
    [branding.primaryHex]
  );
  const iconBackground = useMemo(
    () => `color-mix(in srgb, ${branding.primaryHex} 14%, white)`,
    [branding.primaryHex]
  );

  return (
    <OnboardingLayout>
      <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-10 min-[700px]:px-8 min-[1200px]:px-10">
        <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: iconBackground, color: branding.primaryHex }}
            aria-hidden
          >
            <Check className="h-6 w-6" strokeWidth={2.5} />
          </div>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Application progress
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-8 text-[#101828] sm:text-[28px] sm:leading-9">
            {TITLE}
          </h1>
          <p className="mt-3 text-base leading-6 text-[#4B5563]">{MESSAGE}</p>

          <a
            href={SEARCH_MORE_JOBS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg px-6 text-sm font-semibold text-white transition hover:brightness-[0.97] sm:w-auto"
            style={{ background: buttonBackground }}
          >
            Search more jobs
          </a>
        </div>
      </div>
    </OnboardingLayout>
  );
}
