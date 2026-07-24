import { describe, expect, it } from "vitest";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import {
  contrastForegroundOnHex,
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";

describe("tenantBrandingToFirmaWorkspaceSettings", () => {
  it("maps tenant primary and accent colors to Firma workspace settings", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "#0d9488",
      secondaryHex: "#0f766e",
      accentHex: "#99f6e4",
      buttonColor: "#2563eb",
    });

    expect(colors.color_primary).toBe("#2563eb");
    expect(colors.color_accent).toBe("#99f6e4");
    expect(colors.color_muted_fg).toBe("#0f766e");
    expect(colors.color_background).toBe("#1c1c21");
    expect(colors.color_foreground).toBe("#ffffff");
    expect(colors.color_canvas).toBe("#0f1419");
  });

  it("falls back to primary when accent is missing", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "#2563eb",
      secondaryHex: "#1d4ed8",
      accentHex: "",
      buttonColor: "",
    });

    expect(colors.color_primary).toBe("#2563eb");
    expect(colors.color_accent).toBe("#2563eb");
    expect(colors.color_muted_fg).toBe("#1d4ed8");
  });

  it("uses BrassHR gold when tenant primary is missing", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "",
      secondaryHex: "",
      accentHex: "",
      buttonColor: "",
    });

    expect(colors.color_primary).toBe("#bc8b41");
    expect(colors.color_accent).toBe("#bc8b41");
  });

  it("picks readable foreground on primary surfaces", () => {
    expect(contrastForegroundOnHex("#bc8b41")).toBe("#ffffff");
    expect(contrastForegroundOnHex("#99f6e4")).toBe("#101828");
  });
});
