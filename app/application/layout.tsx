import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap";
import TenantQuerySync from "./TenantQuerySync";
import ApplicantOnboardingGate from "./ApplicantOnboardingGate";
import ApplicantOnboardingRouteGuard from "@/app/components/onboarding/ApplicantOnboardingRouteGuard";
import { loadTenantBrandingBySlug } from "@/lib/tenant/load-tenant-branding-server";
import { isTenantApplicantPortalSlug } from "@/lib/tenant/tenant-branding";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const slug = headersList.get("x-tenant-slug")?.trim().toLowerCase();

  if (!slug || !isTenantApplicantPortalSlug(slug)) {
    return {};
  }

  const favicon = `/api/tenant-favicon?slug=${encodeURIComponent(slug)}`;

  try {
    const branding = await loadTenantBrandingBySlug(slug);
    return {
      title: branding.companyName,
      icons: {
        icon: favicon,
        shortcut: favicon,
        apple: favicon,
      },
    };
  } catch {
    return {
      icons: {
        icon: favicon,
        shortcut: favicon,
        apple: favicon,
      },
    };
  }
}

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  return (
    <ApplicationOnboardingBootstrap>
      <Suspense fallback={null}>
        <TenantQuerySync />
      </Suspense>
      <ApplicantOnboardingGate>
        <ApplicantOnboardingRouteGuard>{children}</ApplicantOnboardingRouteGuard>
      </ApplicantOnboardingGate>
    </ApplicationOnboardingBootstrap>
  );
}
