import { describe, expect, it } from "vitest";
import {
  APPLICANT_PORTAL_CTA_START_APPLICATION,
  applicantLandingCtaLabel,
  isTenantApplicantPortalSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  PLATFORM_ONBOARDING_CTA_GET_STARTED,
} from "@/lib/tenant/tenant-branding";

describe("applicant landing CTA", () => {
  it("treats platform slug and empty as non-applicant portals", () => {
    expect(isTenantApplicantPortalSlug(null)).toBe(false);
    expect(isTenantApplicantPortalSlug("")).toBe(false);
    expect(isTenantApplicantPortalSlug("a")).toBe(false);
    expect(isTenantApplicantPortalSlug(PLATFORM_DEFAULT_TENANT_SLUG)).toBe(false);
    expect(isTenantApplicantPortalSlug("Braas-HR")).toBe(false);
  });

  it("treats real tenant slugs as applicant portals", () => {
    expect(isTenantApplicantPortalSlug("acme-staffing")).toBe(true);
    expect(isTenantApplicantPortalSlug("nexus")).toBe(true);
  });

  it("uses Get Started for platform and Start application for tenants", () => {
    expect(applicantLandingCtaLabel(null)).toBe(PLATFORM_ONBOARDING_CTA_GET_STARTED);
    expect(applicantLandingCtaLabel(PLATFORM_DEFAULT_TENANT_SLUG)).toBe(
      PLATFORM_ONBOARDING_CTA_GET_STARTED
    );
    expect(applicantLandingCtaLabel("acme-staffing")).toBe(
      APPLICANT_PORTAL_CTA_START_APPLICATION
    );
  });
});
