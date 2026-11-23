import {
  brandingFontFamily,
  brandingFontSizePx,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

const ROOT_TYPOGRAPHY_VARS = [
  "--brand-font-family",
  "--brand-font-primary",
  "--brand-font-heading",
  "--brand-font-body",
  "--brand-font-size",
  "--brand-text",
  "--brand-heading",
  "--brand-muted",
] as const;

const DEFAULT_ROOT_FONT_SIZE_PX = 16;

/**
 * Push the active tenant's typography onto `document.documentElement`.
 * Hostname-scoped branding means only the current tenant session is affected.
 * Rem-based Tailwind sizes scale from the root font-size (`base font size`).
 */
export function applyBrandingTypography(branding: TenantBranding): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const bodyFont = brandingFontFamily(branding.bodyFontId);
  const headingFont = brandingFontFamily(branding.headingFontId);
  const primaryFont = brandingFontFamily(branding.primaryFontId);
  const sizePx = brandingFontSizePx(branding.baseFontSizeId);

  root.style.setProperty("--brand-font-family", primaryFont);
  root.style.setProperty("--brand-font-primary", primaryFont);
  root.style.setProperty("--brand-font-heading", headingFont);
  root.style.setProperty("--brand-font-body", bodyFont);
  root.style.setProperty("--brand-font-size", `${sizePx}px`);
  root.style.setProperty("--brand-text", branding.fontColor);
  root.style.setProperty("--brand-heading", branding.headingColor);
  root.style.setProperty("--brand-muted", branding.mutedTextColor);
  root.style.fontSize = `${sizePx}px`;
}

/** Restore browser defaults when no tenant branding is active. */
export function clearBrandingTypography(): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const key of ROOT_TYPOGRAPHY_VARS) {
    root.style.removeProperty(key);
  }
  root.style.fontSize = `${DEFAULT_ROOT_FONT_SIZE_PX}px`;
}
