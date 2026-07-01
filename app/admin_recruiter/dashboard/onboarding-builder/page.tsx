"use client";

import { Suspense } from "react";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";

export default function AdminRecruiterOnboardingBuilderPage() {
  return (
    <div className="admin-recruiter-builder-page">
      <Suspense fallback={null}>
        <TenantOnboardingWorkflowBuilder variant="dashboard" />
      </Suspense>
    </div>
  );
}
