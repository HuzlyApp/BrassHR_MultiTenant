"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ApplicantOnboardingPage from "@/app/components/onboarding/ApplicantOnboardingPage";

function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const tenant = searchParams.get("tenant")?.trim() || "";
  const applicationId = searchParams.get("applicationId")?.trim() || "";

  if (!tenant || !applicationId) {
    return <p role="alert">This onboarding link is missing a tenant or application.</p>;
  }

  return <ApplicantOnboardingPage tenant={tenant} applicationId={applicationId} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p>Loading onboarding…</p>}>
      <OnboardingPageInner />
    </Suspense>
  );
}
