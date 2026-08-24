import { describe, expect, it } from "vitest";
import {
  BRAAS_PLATFORM_FAVICON,
  brandingFallbackForSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import {
  PLATFORM_DOCUMENT_TITLE,
  resolveTenantDocumentFaviconHref,
  resolveTenantDocumentTitle,
  resolveTenantFaviconCacheBuster,
  TENANT_ONBOARDING_DOCUMENT_TITLE,
  withTenantFaviconCacheBuster,
} from "@/lib/tenant/tenant-document-metadata";

describe("tenant-document-metadata", () => {
  it("uses company name as the document title", () => {
    const branding = brandingFallbackForSlug("testcompany", {
      companyName: "Test Company",
    });
    expect(resolveTenantDocumentTitle(branding)).toBe("Test Company");
  });

  it("falls back to Brass HR when company name is empty", () => {
    expect(resolveTenantDocumentTitle({ companyName: "  " })).toBe(PLATFORM_DOCUMENT_TITLE);
  });

  it("uses tenant favicon API for applicant portal tenants", () => {
    const branding: TenantBranding = brandingFallbackForSlug("testcompany", {
      companyName: "Test Company",
      faviconUrl: "",
      logoUrl: "",
    });
    expect(resolveTenantDocumentFaviconHref(branding)).toBe(
      "/api/tenant-favicon?slug=testcompany"
    );
  });

  it("keeps blob favicon previews during branding upload", () => {
    const branding = brandingFallbackForSlug("testcompany", {
      faviconUrl: "blob:http://localhost/preview",
    });
    expect(resolveTenantDocumentFaviconHref(branding)).toBe("blob:http://localhost/preview");
  });

  it("uses platform favicon for platform default tenant", () => {
    expect(resolveTenantDocumentFaviconHref(brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG))).toBe(
      `/api/tenant-favicon?slug=${PLATFORM_DEFAULT_TENANT_SLUG}`
    );
  });

  it("uses upload timestamp as favicon cache buster", () => {
    const branding = brandingFallbackForSlug("testcompany", {
      faviconUrl: "https://cdn.example/storage/favicon-logo.jpg?v=1724328000123",
    });
    expect(resolveTenantFaviconCacheBuster(branding)).toBe("1724328000123");
    expect(withTenantFaviconCacheBuster("/api/tenant-favicon?slug=testcompany", branding)).toBe(
      "/api/tenant-favicon?slug=testcompany&v=1724328000123"
    );
  });

  it("changes favicon href when favicon upload version changes", () => {
    const before = brandingFallbackForSlug("testcompany", {
      faviconUrl: "https://cdn.example/favicon-logo.jpg?v=111",
    });
    const after = brandingFallbackForSlug("testcompany", {
      faviconUrl: "https://cdn.example/favicon-logo.jpg?v=222",
    });
    expect(withTenantFaviconCacheBuster("/api/tenant-favicon?slug=testcompany", before)).not.toBe(
      withTenantFaviconCacheBuster("/api/tenant-favicon?slug=testcompany", after)
    );
  });

  it("reserves Onboarding title constant for tenant onboarding only", () => {
    expect(TENANT_ONBOARDING_DOCUMENT_TITLE).toBe("Onboarding");
    expect(BRAAS_PLATFORM_FAVICON).toContain("favicon");
  });
});
