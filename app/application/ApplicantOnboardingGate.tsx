"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import OnboardingPreviewBanner from "@/app/application/OnboardingPreviewBanner";
import { useOnboardingConfigOptional } from "@/app/components/onboarding/OnboardingConfigProvider";
import { getEnabledTenantSteps } from "@/lib/onboarding/tenant-step-navigation";

function ApplicantOnboardingGateInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onboarding = useOnboardingConfigOptional();

  const isApplicantDashboard = pathname.startsWith("/application/applicant-dashboard");

  if (isApplicantDashboard || !onboarding) {
    return <>{children}</>;
  }

  if (onboarding.loading) {
    return <OnboardingLoader label="Loading your onboarding steps…" />;
  }

  if (onboarding.error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-900">Could not load onboarding</p>
        <p className="mt-2 text-sm text-slate-600">{onboarding.error}</p>
        {onboarding.isDraftPreview ? (
          <p className="mt-4 text-xs text-slate-500">
            Use Preview in the Onboarding Builder to open a draft preview with the current canvas.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void onboarding.refresh()}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const enabledCount = getEnabledTenantSteps(onboarding.config).length;
  if (onboarding.config && enabledCount === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-900">No onboarding steps yet</p>
        <p className="mt-2 text-sm text-slate-600">
          {onboarding.isDraftPreview
            ? "This draft workflow has no applicant-visible steps. Add steps in the builder and preview again."
            : "This organization has not published an applicant onboarding workflow yet."}
        </p>
      </div>
    );
  }

  return (
    <>
      <OnboardingPreviewBanner />
      {children}
    </>
  );
}

/** Loading, error, and empty states for workflow-driven applicant onboarding. */
export default function ApplicantOnboardingGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<OnboardingLoader label="Loading onboarding…" />}>
      <ApplicantOnboardingGateInner>{children}</ApplicantOnboardingGateInner>
    </Suspense>
  );
}
