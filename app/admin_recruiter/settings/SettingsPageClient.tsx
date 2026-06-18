"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import OnboardingStepsBuilderPanel from "@/app/components/onboarding/OnboardingStepsBuilderPanel";
import TenantOnboardingWorkflowBuilder from "@/app/components/onboarding/TenantOnboardingWorkflowBuilder";
import BrandingSettingsPanel from "@/app/admin_recruiter/settings/BrandingSettingsPanel";

type SettingsTab = "onboarding-builder" | "step-editor" | "branding";

function tabClass(active: boolean): string {
  return `shrink-0 cursor-pointer pb-3 pt-1 text-sm font-medium leading-5 whitespace-nowrap transition-colors ${
    active
      ? "-mb-px border-b-2 text-[color:var(--brand-primary)]"
      : "border-b-2 border-transparent text-[#2B3D51] hover:text-[color:var(--brand-primary)]"
  }`;
}

function SettingsTabsInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab =
    tabParam === "step-editor"
      ? "step-editor"
      : tabParam === "branding"
        ? "branding"
        : "onboarding-builder";

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="font-[Inter,sans-serif] text-[18px] font-semibold leading-[28px] text-[#012352]">
          Settings
        </h1>
        <p className="mt-1 max-w-2xl font-[Inter,sans-serif] text-[12px] font-normal leading-[16px] text-[#6B7280]">
          Set up onboarding and your company look. Branding updates apply for your whole organization,
          including worker sign-in.
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
          href="/admin_recruiter/settings?tab=branding"
          className={tabClass(activeTab === "branding")}
          style={activeTab === "branding" ? { borderBottomColor: "var(--brand-primary)" } : undefined}
        >
          Branding
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

      {activeTab === "branding" ? (
        <section aria-labelledby="branding-heading">
          <h2 id="branding-heading" className="sr-only">
            Branding
          </h2>
          <BrandingSettingsPanel />
        </section>
      ) : activeTab === "onboarding-builder" ? (
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
