import { describe, expect, it } from "vitest";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import {
  contrastForegroundOnHex,
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";
describe("tenantBrandingToFirmaWorkspaceSettings", () => {
  it("maps tenant primary and accent into Firma editor color fields", () => {
    const colors = tenantBrandingToFirmaWorkspaceSettings({
      ...defaultTenantBranding(),
      primaryHex: "#0d9488",
      secondaryHex: "#0f766e",
      accentHex: "#99f6e4",
    });

    expect(colors.color_primary).toBe("#0d9488");
    expect(colors.color_accent).toBe("#99f6e4");
    expect(colors.color_muted_fg).toBe("#0f766e");
    expect(colors.color_background).toBe("#1c1c21");
  });

  it("picks readable foreground on primary surfaces", () => {
    expect(contrastForegroundOnHex("#0d9488")).toBe("#ffffff");
    expect(contrastForegroundOnHex("#99f6e4")).toBe("#101828");
  });
});
