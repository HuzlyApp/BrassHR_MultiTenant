import type { CSSProperties } from "react";

/** Shared inline styles for tenant-branded typography (CSS vars from brandingToCssVars). */
export const BRAND_FONT_BODY_STYLE: CSSProperties = {
  fontFamily: "var(--brand-font-body)",
};

export const BRAND_FONT_HEADING_STYLE: CSSProperties = {
  fontFamily: "var(--brand-font-heading)",
};

export const BRAND_FONT_PRIMARY_STYLE: CSSProperties = {
  fontFamily: "var(--brand-font-primary)",
};

export const BRAND_TEXT_COLOR_STYLE: CSSProperties = {
  color: "var(--brand-text)",
};

export const BRAND_HEADING_COLOR_STYLE: CSSProperties = {
  color: "var(--brand-heading)",
};

export const BRAND_MUTED_COLOR_STYLE: CSSProperties = {
  color: "var(--brand-muted)",
};

/**
 * Drop-in replacement for legacy `interStyle` objects.
 * Uses the active tenant body font so auth/onboarding/admin screens stay branded.
 */
export const brandUiFontStyle = {
  fontFamily: "var(--brand-font-body), Inter, Arial, sans-serif",
} as const satisfies CSSProperties;

/** Multiplier is relative to the tenant base font size (default 16px = 1). */
export function brandFontSize(multiplier = 1): string {
  if (multiplier === 1) return "var(--brand-font-size, 16px)";
  return `calc(var(--brand-font-size, 16px) * ${multiplier})`;
}

export function brandBodyTextStyle(multiplier = 1, extras?: CSSProperties): CSSProperties {
  return {
    ...BRAND_FONT_BODY_STYLE,
    fontSize: brandFontSize(multiplier),
    ...extras,
  };
}

export function brandHeadingTextStyle(multiplier = 1, extras?: CSSProperties): CSSProperties {
  return {
    ...BRAND_FONT_HEADING_STYLE,
    fontSize: brandFontSize(multiplier),
    ...extras,
  };
}
