import { describe, expect, it, vi } from "vitest";
import {
  buildBrassHrFirmaEmbedColorPalette,
  patchFirmaTemplateEditorBranding,
  type FirmaEmbedColorPalette,
} from "@/lib/firma/embed-color-palette";

describe("buildBrassHrFirmaEmbedColorPalette", () => {
  it("uses BrassHR gold for primary controls in the embed", () => {
    const palette = buildBrassHrFirmaEmbedColorPalette();
    expect(palette.primary).toBe("#bc8b41");
    expect(palette.accent).toBe("#bc8b41");
    expect(palette.primary_fg).toBe("#ffffff");
  });
});

describe("patchFirmaTemplateEditorBranding", () => {
  it("wraps applyPalette to always apply BrassHR gold", () => {
    const applied: FirmaEmbedColorPalette[] = [];
    const editor = {
      applyPalette(palette: FirmaEmbedColorPalette) {
        applied.push(palette);
      },
    };

    patchFirmaTemplateEditorBranding(editor);

    expect(applied).toHaveLength(1);
    expect(applied[0]?.primary).toBe("#bc8b41");

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
    expect(applied[1]?.primary).toBe("#bc8b41");
    expect(applied[1]?.accent).toBe("#bc8b41");
  });

  it("ignores editors without applyPalette", () => {
    expect(() => patchFirmaTemplateEditorBranding({ destroy: vi.fn() })).not.toThrow();
  });
});
