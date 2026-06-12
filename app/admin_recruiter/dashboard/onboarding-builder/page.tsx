"use client";

import { Suspense } from "react";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";

export default function AdminRecruiterOnboardingBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-64px-56px)] items-center justify-center text-sm text-slate-500">
          Loading onboarding builder...
        </div>
      }
    >
      <TenantOnboardingWorkflowBuilder variant="dashboard" />
    </Suspense>
  );
}
