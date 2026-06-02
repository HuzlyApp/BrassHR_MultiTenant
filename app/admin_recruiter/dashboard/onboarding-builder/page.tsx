"use client";

import { OnboardingBuilderPage } from "@/app/braas-hr/dashboard/onboarding-builder/page";

export default function AdminRecruiterOnboardingBuilderPage() {
  return (
    <OnboardingBuilderPage
      dashboardBasePath="/admin_recruiter/dashboard"
      redirectLegacyPath={false}
      hideTopChrome
    />
  );
}
