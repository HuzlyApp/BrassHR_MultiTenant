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

export const PLATFORM_DEFAULT_TENANT_SLUG = "braas-hr";

/** Braas Figma login UI; other tenants use classic OnboardingLayout login. */
export function usesBraasFigmaLoginUi(tenantQuery: string | null | undefined): boolean {
  const key = tenantQuery?.trim().toLowerCase();
  if (!key || key.length < 2) return true;
  return key === PLATFORM_DEFAULT_TENANT_SLUG;
}

/** Braas HR platform owner UI (login, signup, tenant-onboarding shell). */
export const BRAAS_PRIMARY = "#BC8B41";
export const BRAAS_SECONDARY = "#104b83";
export const BRAAS_ACCENT = "#E9B771";

/** Nexus tenant defaults when DB fields are empty. */
export const NEXUS_PRIMARY = "#0d9488";
export const NEXUS_SECONDARY = "#0f766e";
export const NEXUS_ACCENT = "#99f6e4";

/** @deprecated Use slug-specific fallbacks via `brandingFallbackForSlug`. */
export const FALLBACK_PRIMARY = BRAAS_PRIMARY;
export const FALLBACK_SECONDARY = BRAAS_SECONDARY;
export const FALLBACK_ACCENT = BRAAS_ACCENT;

const DEFAULT_LOGO = "/images/new-logo-nexus.svg";
const DEFAULT_BACKGROUND = "/images/handshake.jpg";

/** Reject placeholder junk (e.g. DB value "test") and non-URL strings for next/image. */
export function normalizeBrandingImageSrc(
  src: string | null | undefined,
  fallback: string,
  options?: { allowBlob?: boolean }
): string {
  const raw = src?.trim();
  if (!raw) return fallback;

  if (raw.startsWith("/")) return raw;

  if (raw.startsWith("blob:")) {
    return options?.allowBlob ? raw : fallback;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return raw;
  } catch {
    /* not an absolute URL */
  }

  return fallback;
}

export function isRemoteOrBlobImageSrc(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:");
}

export function defaultTenantBranding(overrides: Partial<TenantBranding> = {}): TenantBranding {
  return brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG, overrides);
}

/** Per-tenant static fallbacks — never apply Braas assets to other tenants. */
export function brandingFallbackForSlug(
  slug: string | null | undefined,
  overrides: Partial<TenantBranding> = {}
): TenantBranding {
  const key = slug?.trim().toLowerCase() ?? "";
  const name =
    key === "nexus"
      ? "Nexus"
      : key === PLATFORM_DEFAULT_TENANT_SLUG
        ? "Braas HR"
        : "Your organization";

  const base: TenantBranding =
    key === "nexus"
      ? {
          id: null,
          slug: "nexus",
          companyName: name,
          logoUrl: "/images/new-logo-nexus.svg",
          headline: `Welcome to ${name}`,
          subtitle: "Quick pay, flexible shifts, support team",
          loginBackgroundSrc: "/images/handshake.jpg",
          primaryHex: NEXUS_PRIMARY,
          secondaryHex: NEXUS_SECONDARY,
          accentHex: NEXUS_ACCENT,
          tagline: `Connecting Healthcare professionals — ${name}.`,
        }
      : {
          id: null,
          slug: key === PLATFORM_DEFAULT_TENANT_SLUG ? PLATFORM_DEFAULT_TENANT_SLUG : key || null,
          companyName: name,
          logoUrl: "/icons/braas-HR/BrassHR-logo.svg",
          headline: `Welcome to ${name}`,
          subtitle: "HR Simplified for growing teams",
          loginBackgroundSrc: "/images/singup-bg-image.jpg",
          primaryHex: BRAAS_PRIMARY,
          secondaryHex: BRAAS_SECONDARY,
          accentHex: BRAAS_ACCENT,
          tagline: "HR Simplified for growing teams",
        };

  return { ...base, ...overrides };
}

export function brandingFromTenantRow(
  row: TenantBrandingRow | null,
  requestedSlug?: string | null
): TenantBranding {
  if (!row) return brandingFallbackForSlug(requestedSlug ?? PLATFORM_DEFAULT_TENANT_SLUG);
  const fb = brandingFallbackForSlug(row.slug);
  const company = row.name?.trim() || fb.companyName;
  return {
    id: row.id,
    slug: row.slug,
    companyName: company,
    logoUrl: normalizeBrandingImageSrc(row.logo_url, fb.logoUrl, { allowBlob: true }),
    headline: row.welcome_headline?.trim() || `Welcome to ${company}`,
    subtitle: row.welcome_subtitle?.trim() || fb.subtitle,
    loginBackgroundSrc: normalizeBrandingImageSrc(row.auth_background_image_url, fb.loginBackgroundSrc),
    primaryHex: row.primary_color?.trim() || fb.primaryHex,
    secondaryHex: row.secondary_color?.trim() || fb.secondaryHex,
    accentHex: row.accent_color?.trim() || fb.accentHex,
    tagline: row.welcome_subtitle?.trim()
      ? row.welcome_subtitle.trim()
      : `Connecting Healthcare professionals — ${company}.`,
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
