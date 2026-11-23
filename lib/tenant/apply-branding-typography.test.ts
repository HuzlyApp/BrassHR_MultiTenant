/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBrandingTypography,
  clearBrandingTypography,
} from "@/lib/tenant/apply-branding-typography";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";

describe("applyBrandingTypography", () => {
  afterEach(() => {
    clearBrandingTypography();
    vi.unstubAllGlobals();
  });

  it("writes tenant typography CSS vars onto documentElement", () => {
    const branding = defaultTenantBranding({
      bodyFontId: "poppins",
      headingFontId: "ubuntu",
      primaryFontId: "roboto",
      baseFontSizeId: "xs",
      fontColor: "#111111",
      headingColor: "#222222",
      mutedTextColor: "#333333",
    });

    applyBrandingTypography(branding);

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--brand-font-size")).toBe("12px");
    expect(root.style.fontSize).toBe("12px");
    expect(root.style.getPropertyValue("--brand-text")).toBe("#111111");
    expect(root.style.getPropertyValue("--brand-heading")).toBe("#222222");
    expect(root.style.getPropertyValue("--brand-muted")).toBe("#333333");
    expect(root.style.getPropertyValue("--brand-font-body")).toContain("poppins");
    expect(root.style.getPropertyValue("--brand-font-heading")).toContain("ubuntu");
  });

  it("clears typography overrides", () => {
    applyBrandingTypography(
      defaultTenantBranding({ baseFontSizeId: "lg", fontColor: "#010101" })
    );
    clearBrandingTypography();
    expect(document.documentElement.style.getPropertyValue("--brand-font-size")).toBe("");
    expect(document.documentElement.style.fontSize).toBe("16px");
  });
});
