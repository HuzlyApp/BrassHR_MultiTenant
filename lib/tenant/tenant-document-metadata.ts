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

/** Cache-bust token from the stored favicon/logo URL (upload flow adds ?v=timestamp). */
export function resolveTenantFaviconCacheBuster(
  branding: Pick<TenantBranding, "faviconUrl" | "logoUrl" | "slug">
): string {
  const icon = branding.faviconUrl?.trim() || branding.logoUrl?.trim() || "";
  if (icon && !icon.startsWith("blob:")) {
    try {
      const version = new URL(icon).searchParams.get("v");
      if (version) return version;
    } catch {
      // Relative or invalid URL — fall through to hash.
    }
    let hash = 0;
    for (let i = 0; i < icon.length; i++) {
      hash = (Math.imul(31, hash) + icon.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
  }
  return branding.slug?.trim() || "default";
}

export function withTenantFaviconCacheBuster(
  href: string,
  branding: Pick<TenantBranding, "faviconUrl" | "logoUrl" | "slug">
): string {
  if (href.startsWith("blob:") || href.startsWith("data:")) return href;
  const bust = resolveTenantFaviconCacheBuster(branding);
  return `${href}${href.includes("?") ? "&" : "?"}v=${encodeURIComponent(bust)}`;
}

/** Next.js Metadata for tenant-branded surfaces (login, admin, worker, applicant). */
export function buildTenantDocumentMetadata(branding: TenantBranding): Metadata {
  const title = resolveTenantDocumentTitle(branding);
  const favicon = withTenantFaviconCacheBuster(resolveTenantDocumentFaviconHref(branding), branding);
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
