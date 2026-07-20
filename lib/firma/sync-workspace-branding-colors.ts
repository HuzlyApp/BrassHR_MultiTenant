import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
import { BRAAS_PRIMARY, BRAAS_SECONDARY } from "@/lib/tenant/tenant-branding";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function normalizeHex(value: string | null | undefined, fallback: string): string {
  const raw = value?.trim();
  if (!raw) return fallback.toLowerCase();

  if (HEX_RE.test(raw)) return raw.toLowerCase();

  const bare = raw.replace(/^#/, "");
  if (/^[0-9A-Fa-f]{6}$/.test(bare)) return `#${bare.toLowerCase()}`;
  if (/^[0-9A-Fa-f]{3}$/.test(bare)) {
    const expanded = bare
      .split("")
      .map((char) => char + char)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }

  return fallback.toLowerCase();
}

/** Pick light or dark text for buttons and accent surfaces. */
export function contrastForegroundOnHex(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#101828" : "#ffffff";
}

/** Firma Appearance tab defaults aligned with app.firma.dev/settings?tab=appearance. */
export const BRAAS_FIRMA_APPEARANCE_DEFAULTS = {
  background: "#1c1c21",
  foreground: "#ffffff",
  card: "#22222a",
  border: "#3b3b3b",
  canvas: "#0f1419",
  muted: "#22222a",
  mutedFg: "#b8b8b8",
} as const;

/**
 * BrassHR appearance payload for Firma company + workspace settings APIs.
 * Primary drives buttons, field icons, and zoom controls in the embedded editor.
 */
export function buildBrassHrFirmaAppearanceSettings(): FirmaWorkspaceAppearanceSettings {
  const primary = normalizeHex(BRAAS_PRIMARY, "#bc8b41");
  const secondary = normalizeHex(BRAAS_SECONDARY, primary);
  const primaryFg = contrastForegroundOnHex(primary);
  const accentFg = contrastForegroundOnHex(primary);

  return {
    color_primary: primary,
    color_primary_fg: primaryFg,
    color_accent: primary,
    color_accent_fg: accentFg,
    color_background: BRAAS_FIRMA_APPEARANCE_DEFAULTS.background,
    color_foreground: BRAAS_FIRMA_APPEARANCE_DEFAULTS.foreground,
    color_card: BRAAS_FIRMA_APPEARANCE_DEFAULTS.card,
    color_border: BRAAS_FIRMA_APPEARANCE_DEFAULTS.border,
    color_canvas: BRAAS_FIRMA_APPEARANCE_DEFAULTS.canvas,
    color_muted: BRAAS_FIRMA_APPEARANCE_DEFAULTS.muted,
    color_muted_fg: secondary,
  };
}

/**
 * Maps BrassHR appearance for Firma template builder + signing embeds.
 * Tenant branding is ignored — Firma chrome always uses BrassHR gold (#BC8B41).
 */
export function tenantBrandingToFirmaWorkspaceSettings(
  _branding: TenantBranding
): FirmaWorkspaceAppearanceSettings {
  return buildBrassHrFirmaAppearanceSettings();
}
