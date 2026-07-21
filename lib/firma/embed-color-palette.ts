import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
import {
  buildBrassHrFirmaAppearanceSettings,
  tenantBrandingToFirmaWorkspaceSettings,
} from "@/lib/firma/sync-workspace-branding-colors";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

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

export function firmaAppearanceSettingsToEmbedPalette(
  settings: FirmaWorkspaceAppearanceSettings
): FirmaEmbedColorPalette {
  const brass = buildBrassHrFirmaAppearanceSettings();
  return {
    primary: (settings.color_primary ?? brass.color_primary ?? "#bc8b41").toLowerCase(),
    primary_fg: (settings.color_primary_fg ?? brass.color_primary_fg ?? "#ffffff").toLowerCase(),
    accent: (settings.color_accent ?? settings.color_primary ?? brass.color_accent ?? "#bc8b41").toLowerCase(),
    accent_fg: (settings.color_accent_fg ?? brass.color_accent_fg ?? "#ffffff").toLowerCase(),
    background: (settings.color_background ?? brass.color_background ?? "#1c1c21").toLowerCase(),
    foreground: (settings.color_foreground ?? brass.color_foreground ?? "#ffffff").toLowerCase(),
    card: (settings.color_card ?? brass.color_card ?? "#22222a").toLowerCase(),
    border: (settings.color_border ?? brass.color_border ?? "#3b3b3b").toLowerCase(),
    canvas: (settings.color_canvas ?? brass.color_canvas ?? "#0f1419").toLowerCase(),
    muted: (settings.color_muted ?? brass.color_muted ?? "#22222a").toLowerCase(),
    muted_fg: (settings.color_muted_fg ?? brass.color_muted_fg ?? "#b8b8b8").toLowerCase(),
  };
}

/** Tenant-specific palette for FirmaTemplateEditor.applyPalette (embed chrome). */
export function tenantBrandingToFirmaEmbedColorPalette(
  branding: TenantBranding
): FirmaEmbedColorPalette {
  return firmaAppearanceSettingsToEmbedPalette(tenantBrandingToFirmaWorkspaceSettings(branding));
}

/** BrassHR platform palette (fallback when tenant branding is unavailable). */
export function buildBrassHrFirmaEmbedColorPalette(): FirmaEmbedColorPalette {
  return firmaAppearanceSettingsToEmbedPalette(buildBrassHrFirmaAppearanceSettings());
}

/**
 * Firma's embedded template-data endpoint can return stale workspace colors.
 * Force the editor shadow DOM palette to the tenant workspace colors whenever Firma calls applyPalette.
 */
export function patchFirmaTemplateEditorBranding(
  editor: FirmaTemplateEditorWithPalette | null | undefined,
  palette: FirmaEmbedColorPalette = buildBrassHrFirmaEmbedColorPalette()
): void {
  if (!editor?.applyPalette) return;

  const original = editor.applyPalette.bind(editor);
  editor.applyPalette = () => original(palette);
  original(palette);
}
