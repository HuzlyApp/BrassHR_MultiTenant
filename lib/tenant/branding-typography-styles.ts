import type { CSSProperties } from "react";

/** Shared inline styles for tenant-branded typography (CSS vars from brandingToCssVars). */
export const BRAND_FONT_BODY_STYLE: CSSProperties = {
  fontFamily: "var(--brand-font-body)",
};

export const BRAND_FONT_HEADING_STYLE: CSSProperties = {
  fontFamily: "var(--brand-font-heading)",
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
