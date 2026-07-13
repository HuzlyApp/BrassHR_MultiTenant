"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import BrandingSettingsPanel from "@/app/admin_recruiter/settings/BrandingSettingsPanel";

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTab = searchParams.get("tab");

  useEffect(() => {
    if (legacyTab) {
      router.replace("/admin_recruiter/settings");
    }
  }, [legacyTab, router]);

  return (
    <main className="w-full min-w-0 max-w-full space-y-6 px-5 pb-8 pt-5 lg:px-8">
      <div>
        <h1 className="font-[Inter,sans-serif] text-[22px] font-semibold leading-8 tracking-tight text-[#012352]">
          Settings
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748B]">
          Set up onboarding and your company look. Branding updates apply for your whole organization,
          including worker sign-in.
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md bg-[#E8F5F4] px-3 py-1.5 font-medium text-[#0f514e]">
            Branding
          </span>
          <Link
            href="/admin_recruiter/settings/workflow-configuration"
            className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-[#334155] hover:bg-[#F8FAFC]"
          >
            Workflow Configuration
          </Link>
        </nav>
      </div>

      <section aria-labelledby="branding-heading">
        <h2 id="branding-heading" className="sr-only">
          Branding
        </h2>
        <BrandingSettingsPanel />
      </section>
    </main>
  );
}

export default function SettingsPageClient() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}
