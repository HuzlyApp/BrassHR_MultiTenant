import { BRAAS_PRIMARY, BRAAS_SECONDARY } from "@/lib/tenant/tenant-branding";
import { BRAAS_FIRMA_APPEARANCE_DEFAULTS } from "@/lib/firma/sync-workspace-branding-colors";

/** Resolved palette keys returned by Firma get-embedded-template-data. */
export type FirmaEmbedColorPalette = {
  primary: string;
  primary_fg: string;
  background: string;
  foreground: string;
  card: string;
  border: string;
  accent: string;
  accent_fg: string;
  canvas: string;
  muted: string;
  muted_fg: string;
};

export type FirmaTemplateEditorWithPalette = {
  applyPalette?: (palette: FirmaEmbedColorPalette) => void;
  destroy?: () => void;
};

/** BrassHR gold palette for FirmaTemplateEditor.applyPalette (embed chrome). */
export function buildBrassHrFirmaEmbedColorPalette(): FirmaEmbedColorPalette {
  return {
    primary: BRAAS_PRIMARY.toLowerCase(),
    primary_fg: "#ffffff",
    accent: BRAAS_PRIMARY.toLowerCase(),
    accent_fg: "#ffffff",
    background: BRAAS_FIRMA_APPEARANCE_DEFAULTS.background,
    foreground: BRAAS_FIRMA_APPEARANCE_DEFAULTS.foreground,
    card: BRAAS_FIRMA_APPEARANCE_DEFAULTS.card,
    border: BRAAS_FIRMA_APPEARANCE_DEFAULTS.border,
    canvas: BRAAS_FIRMA_APPEARANCE_DEFAULTS.canvas,
    muted: BRAAS_FIRMA_APPEARANCE_DEFAULTS.muted,
    muted_fg: BRAAS_SECONDARY.toLowerCase(),
  };
}

/**
 * Firma's embedded template-data endpoint can return legacy Nexus teal (#0d9488)
 * even when company/workspace appearance APIs report BrassHR gold.
 * Force the editor shadow DOM palette to gold whenever Firma calls applyPalette.
 */
export function patchFirmaTemplateEditorBranding(
  editor: FirmaTemplateEditorWithPalette | null | undefined
): void {
  if (!editor?.applyPalette) return;

  const gold = buildBrassHrFirmaEmbedColorPalette();
  const original = editor.applyPalette.bind(editor);
  editor.applyPalette = () => original(gold);
  original(gold);
}
