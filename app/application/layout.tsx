import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import ApplicationOnboardingBootstrap from "./ApplicationOnboardingBootstrap";
import TenantQuerySync from "./TenantQuerySync";
import ApplicantOnboardingGate from "./ApplicantOnboardingGate";
import ApplicantOnboardingRouteGuard from "@/app/components/onboarding/ApplicantOnboardingRouteGuard";
import { loadTenantBrandingBySlug } from "@/lib/tenant/load-tenant-branding-server";
import {
  brandingFallbackForSlug,
  isTenantApplicantPortalSlug,
} from "@/lib/tenant/tenant-branding";
import { buildTenantDocumentMetadata } from "@/lib/tenant/tenant-document-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const slug = headersList.get("x-tenant-slug")?.trim().toLowerCase();

  if (!slug || !isTenantApplicantPortalSlug(slug)) {
    return {};
  }

  try {
    const branding = await loadTenantBrandingBySlug(slug);
    return buildTenantDocumentMetadata(branding);
  } catch {
    return buildTenantDocumentMetadata(brandingFallbackForSlug(slug));
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
