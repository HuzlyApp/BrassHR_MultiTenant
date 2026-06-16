"use client";

import { Suspense } from "react";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";
import CandidateDetailLoader from "@/app/admin_recruiter/components/CandidateDetailLoader";

export default function AdminRecruiterOnboardingBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-64px-56px)] flex-col overflow-hidden">
          <CandidateDetailLoader
            label="Loading onboarding builder..."
            className="min-h-0 flex-1 bg-transparent"
          />
        </div>
      }
    >
      <TenantOnboardingWorkflowBuilder variant="dashboard" />
    </Suspense>
  );
}
