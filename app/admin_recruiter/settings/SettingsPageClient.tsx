"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OnboardingStepsBuilderPanel from "@/app/components/onboarding/OnboardingStepsBuilderPanel";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";

type SettingsTab = "onboarding-builder" | "step-editor";

function tabClass(active: boolean): string {
  return `shrink-0 pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    active
      ? "-mb-px border-b-2 text-[color:var(--brand-primary)]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
  }`;
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

      <nav
        className="mb-2 flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-[#E5E7EB]"
        aria-label="Settings sections"
      >
        <Link
          href="/admin_recruiter/settings?tab=onboarding-builder"
          className={tabClass(activeTab === "onboarding-builder")}
          style={
            activeTab === "onboarding-builder"
              ? { borderBottomColor: "var(--brand-primary)" }
              : undefined
          }
        >
          Onboarding Builder
        </Link>
        <Link
          href="/admin_recruiter/settings?tab=step-editor"
          className={tabClass(activeTab === "step-editor")}
          style={
            activeTab === "step-editor" ? { borderBottomColor: "var(--brand-primary)" } : undefined
          }
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
        <section aria-labelledby="step-editor-heading" className="space-y-4">
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
