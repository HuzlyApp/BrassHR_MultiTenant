"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OnboardingStepsBuilderPanel from "@/app/components/onboarding/OnboardingStepsBuilderPanel";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";

type SettingsTab = "onboarding-builder" | "step-editor";

function tabClass(active: boolean): string {
  return active
    ? "border-b-2 border-[#0d9488] pb-3 text-sm font-semibold text-[#0d9488]"
    : "border-b-2 border-transparent pb-3 text-sm font-medium text-[#64748B] hover:text-[#0F172A]";
}

function SettingsTabsInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab =
    tabParam === "step-editor" ? "step-editor" : "onboarding-builder";

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#64748B]">
          Configure worker onboarding for the active tenant. Use the header tenant switcher to edit
          another organization — each tenant has its own flow.
        </p>
      </div>

      <nav className="flex gap-6 border-b border-[#E2E8F0]" aria-label="Settings sections">
        <Link
          href="/admin_recruiter/settings?tab=onboarding-builder"
          className={tabClass(activeTab === "onboarding-builder")}
        >
          Onboarding Builder
        </Link>
        <Link
          href="/admin_recruiter/settings?tab=step-editor"
          className={tabClass(activeTab === "step-editor")}
        >
          Step editor
        </Link>
      </nav>

      {activeTab === "onboarding-builder" ? (
        <section aria-labelledby="onboarding-builder-heading">
          <h2 id="onboarding-builder-heading" className="sr-only">
            Onboarding Builder
          </h2>
          <TenantOnboardingWorkflowBuilder />
        </section>
      ) : (
        <section aria-labelledby="step-editor-heading" className="max-w-3xl space-y-4">
          <div>
            <h2 id="step-editor-heading" className="text-lg font-semibold text-[#0F172A]">
              Worker onboarding steps
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Enable, reorder, and customize applicant steps. Changes apply to new applications
              immediately when published from the builder or saved here.
            </p>
          </div>
          <OnboardingStepsBuilderPanel mode="admin-settings" />
        </section>
      )}
    </main>
  );
}

export default function SettingsPageClient() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading settings…</div>}>
      <SettingsTabsInner />
    </Suspense>
  );
}
