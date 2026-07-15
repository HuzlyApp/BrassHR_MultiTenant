import { describe, expect, it } from "vitest";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import {
  contrastForegroundOnHex,
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";
describe("tenantBrandingToFirmaWorkspaceSettings", () => {
  it("maps primary/secondary brand colors into Firma chrome (not stale buttonColor)", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "#0d9488",
      secondaryHex: "#0f766e",
      accentHex: "#99f6e4",
      buttonColor: "#2563eb",
    });

    expect(colors.color_primary).toBe("#0d9488");
    expect(colors.color_accent).toBe("#0d9488");
    expect(colors.color_muted_fg).toBe("#0f766e");
    expect(colors.color_background).toBe("#1c1c21");
  });

  it("falls back to buttonColor when primary is missing", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "",
      secondaryHex: "",
      accentHex: "",
      buttonColor: "#2563eb",
    });

    expect(colors.color_primary).toBe("#2563eb");
    expect(colors.color_accent).toBe("#2563eb");
  });

  it("accepts hex colors without a leading hash", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "0d9488",
      secondaryHex: "0f766e",
      buttonColor: "2563eb",
    });

    expect(colors.color_primary).toBe("#0d9488");
    expect(colors.color_muted_fg).toBe("#0f766e");
  });

  it("picks readable foreground on primary surfaces", () => {
    expect(contrastForegroundOnHex("#0d9488")).toBe("#ffffff");
    expect(contrastForegroundOnHex("#99f6e4")).toBe("#101828");
  });
});
