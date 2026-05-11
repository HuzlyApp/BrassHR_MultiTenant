/** Row shape compatible with PostgREST `tenants`. */
export type TenantBrandingRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  welcome_headline: string | null;
  welcome_subtitle: string | null;
  auth_background_image_url: string | null;
};

/** Runtime branding used by UI (+ CSS vars). */
export type TenantBranding = {
  id: string | null;
  slug: string | null;
  companyName: string;
  logoUrl: string;
  headline: string;
  subtitle: string;
  loginBackgroundSrc: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  tagline: string;
};

export const FALLBACK_PRIMARY = "#0d9488";
export const FALLBACK_SECONDARY = "#0f766e";
export const FALLBACK_ACCENT = "#99f6e4";

export function defaultTenantBranding(overrides: Partial<TenantBranding> = {}): TenantBranding {
  const base: TenantBranding = {
    id: null,
    slug: null,
    companyName: "Staffing onboarding",
    logoUrl: "/images/new-logo-nexus.svg",
    headline: "Join our team",
    subtitle: "Quick pay, flexible shifts, support team",
    loginBackgroundSrc: "/images/handshake.jpg",
    primaryHex: FALLBACK_PRIMARY,
    secondaryHex: FALLBACK_SECONDARY,
    accentHex: FALLBACK_ACCENT,
    tagline: "Connecting professionals with hiring teams.",
  };
  return { ...base, ...overrides };
}

export function brandingFromTenantRow(row: TenantBrandingRow | null): TenantBranding {
  if (!row) return defaultTenantBranding();
  return {
    id: row.id,
    slug: row.slug,
    companyName: row.name?.trim() || defaultTenantBranding().companyName,
    logoUrl: row.logo_url?.trim() || defaultTenantBranding().logoUrl,
    headline:
      row.welcome_headline?.trim() ||
      `Welcome to ${row.name?.trim() || "your organization"}`,
    subtitle: row.welcome_subtitle?.trim() || defaultTenantBranding().subtitle,
    loginBackgroundSrc: row.auth_background_image_url?.trim() || "/images/handshake.jpg",
    primaryHex: row.primary_color?.trim() || FALLBACK_PRIMARY,
    secondaryHex: row.secondary_color?.trim() || FALLBACK_SECONDARY,
    accentHex: row.accent_color?.trim() || FALLBACK_ACCENT,
    tagline: row.welcome_subtitle?.trim()
      ? row.welcome_subtitle.trim()
      : `Connecting Healthcare professionals — ${row.name?.trim() || "your organization"}.`,
  };
}

/** Apply CSS variables consumed by onboarding / auth surfaces. */
export function brandingToCssVars(b: TenantBranding): Record<string, string> {
  return {
    "--brand-primary": b.primaryHex,
    "--brand-secondary": b.secondaryHex,
    "--brand-accent": b.accentHex,
    "--brand-gradient-from": lightenForGradient(b.primaryHex),
    "--brand-gradient-to": b.secondaryHex,
  };
}

function lightenForGradient(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return hex;
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + 36);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + 42);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + 40);
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function to2(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}
