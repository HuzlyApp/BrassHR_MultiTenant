import type { FirmaWorkspaceAppearanceSettings } from "@/lib/firma/types";
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

/**
 * Maps BrassHR tenant branding to Firma workspace editor/signing colors.
 * Uses a dark editor shell (matches Firma template builder) with tenant accent colors.
 */
export function tenantBrandingToFirmaWorkspaceSettings(
  branding: TenantBranding
): FirmaWorkspaceAppearanceSettings {
  const primary = normalizeHex(branding.buttonColor || branding.primaryHex, "#bc8b41");
  const secondary = normalizeHex(branding.secondaryHex, "#104b83");
  const accent = normalizeHex(branding.primaryHex, primary);
  const primaryFg = contrastForegroundOnHex(primary);
  const accentFg = contrastForegroundOnHex(accent);

  return {
    color_primary: primary,
    color_primary_fg: primaryFg,
    color_accent: accent,
    color_accent_fg: accentFg,
    color_background: "#1c1c21",
    color_foreground: "#f8fafc",
    color_card: "#22222a",
    color_border: "#3b3b3b",
    color_canvas: "#2a2a32",
    color_muted: "#2e2e36",
    color_muted_fg: secondary,
  };
}
