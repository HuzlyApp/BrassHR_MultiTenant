"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ApplicantOnboardingPage from "@/app/components/onboarding/ApplicantOnboardingPage";

function OnboardingPageInner() {
  const searchParams = useSearchParams();
  const tenant = searchParams.get("tenant")?.trim() || "subdomaintest";
  const applicationId = searchParams.get("applicationId")?.trim() || "app_123";

  return <ApplicantOnboardingPage tenant={tenant} applicationId={applicationId} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<p>Loading onboarding…</p>}>
      <OnboardingPageInner />
    </Suspense>
  );
}
