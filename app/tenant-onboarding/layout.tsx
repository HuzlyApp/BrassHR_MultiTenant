import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  tenantBrandingInter,
  tenantBrandingPoppins,
  tenantBrandingRoboto,
  tenantBrandingUbuntu,
} from "@/app/fonts";
import { buildTenantOnboardingDocumentMetadata } from "@/lib/tenant/tenant-document-metadata";

export const metadata: Metadata = buildTenantOnboardingDocumentMetadata();

export default function TenantOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`tenant-onboarding-light min-h-screen bg-white text-[#0f172a] ${tenantBrandingInter.variable} ${tenantBrandingRoboto.variable} ${tenantBrandingPoppins.variable} ${tenantBrandingUbuntu.variable}`}
      style={{ colorScheme: "light only" }}
    >
      {children}
    </div>
  );
}
