import { describe, expect, it, vi } from "vitest";
import {
  buildBrassHrFirmaEmbedColorPalette,
  patchFirmaTemplateEditorBranding,
  tenantBrandingToFirmaEmbedColorPalette,
  type FirmaEmbedColorPalette,
} from "@/lib/firma/embed-color-palette";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";

describe("buildBrassHrFirmaEmbedColorPalette", () => {
  it("uses BrassHR gold for primary controls in the embed", () => {
    const palette = buildBrassHrFirmaEmbedColorPalette();
    expect(palette.primary).toBe("#bc8b41");
    expect(palette.accent).toBe("#bc8b41");
    expect(palette.primary_fg).toBe("#ffffff");
  });
});

describe("tenantBrandingToFirmaEmbedColorPalette", () => {
  it("uses tenant button and accent colors", () => {
    const palette = tenantBrandingToFirmaEmbedColorPalette({
      ...defaultTenantBranding(),
      primaryHex: "#0d9488",
      accentHex: "#99f6e4",
      buttonColor: "#2563eb",
      secondaryHex: "#0f766e",
    });

    expect(palette.primary).toBe("#2563eb");
    expect(palette.accent).toBe("#99f6e4");
    expect(palette.muted_fg).toBe("#0f766e");
  });
});

describe("patchFirmaTemplateEditorBranding", () => {
  it("wraps applyPalette to always apply the provided tenant palette", () => {
    const applied: FirmaEmbedColorPalette[] = [];
    const editor = {
      applyPalette(palette: FirmaEmbedColorPalette) {
        applied.push(palette);
      },
    };

    const tenantPalette = tenantBrandingToFirmaEmbedColorPalette({
      ...defaultTenantBranding(),
      buttonColor: "#2563eb",
      accentHex: "#93c5fd",
      secondaryHex: "#1d4ed8",
    });

    patchFirmaTemplateEditorBranding(editor, tenantPalette);

    expect(applied).toHaveLength(1);
    expect(applied[0]?.primary).toBe("#2563eb");

    editor.applyPalette({
      primary: "#0d9488",
      primary_fg: "#ffffff",
      background: "#1c1c21",
      foreground: "#ffffff",
      card: "#22222a",
      border: "#3b3b3b",
      accent: "#0d9488",
      accent_fg: "#ffffff",
      canvas: "#2a2a32",
      muted: "#2e2e36",
      muted_fg: "#0f766e",
    });

    expect(applied).toHaveLength(2);
    expect(applied[1]?.primary).toBe("#2563eb");
    expect(applied[1]?.accent).toBe("#93c5fd");
  });

  it("ignores editors without applyPalette", () => {
    expect(() => patchFirmaTemplateEditorBranding({ destroy: vi.fn() })).not.toThrow();
  });
});
