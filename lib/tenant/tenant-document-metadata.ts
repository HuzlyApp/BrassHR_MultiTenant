import type { Metadata } from "next";
import {
  BRAAS_PLATFORM_FAVICON,
  isTenantApplicantPortalSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

/** Platform default tab title when no tenant company name is available. */
export const PLATFORM_DOCUMENT_TITLE = "Brass HR";

/** Tab title reserved for owner/company setup (`/tenant-onboarding`). */
export const TENANT_ONBOARDING_DOCUMENT_TITLE = "Onboarding";

export function resolveTenantDocumentTitle(branding: Pick<TenantBranding, "companyName">): string {
  return branding.companyName?.trim() || PLATFORM_DOCUMENT_TITLE;
}

export function resolveTenantDocumentFaviconHref(
  branding: Pick<TenantBranding, "slug" | "faviconUrl" | "logoUrl">
): string {
  const slug = branding.slug?.trim().toLowerCase() ?? "";

  // Live upload previews during branding editors.
  const direct = branding.faviconUrl?.trim() || branding.logoUrl?.trim() || "";
  if (direct.startsWith("blob:")) return direct;

  if (slug && (isTenantApplicantPortalSlug(slug) || slug === PLATFORM_DEFAULT_TENANT_SLUG)) {
    return `/api/tenant-favicon?slug=${encodeURIComponent(slug)}`;
  }

  return BRAAS_PLATFORM_FAVICON;
}

/** Next.js Metadata for tenant-branded surfaces (login, admin, worker, applicant). */
export function buildTenantDocumentMetadata(branding: TenantBranding): Metadata {
  const title = resolveTenantDocumentTitle(branding);
  const favicon = resolveTenantDocumentFaviconHref(branding);
  return {
    title: { absolute: title },
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
  };
}

export function buildTenantOnboardingDocumentMetadata(): Metadata {
  return {
    title: { absolute: TENANT_ONBOARDING_DOCUMENT_TITLE },
    icons: {
      icon: BRAAS_PLATFORM_FAVICON,
      shortcut: BRAAS_PLATFORM_FAVICON,
      apple: BRAAS_PLATFORM_FAVICON,
    },
  };
}
