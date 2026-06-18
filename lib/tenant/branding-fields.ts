import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";

export const TENANT_BRANDING_SELECT =
  "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url";

export type TenantBrandingUpdateInput = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  welcomeHeadline?: string | null;
  welcomeSubtitle?: string | null;
  authBackgroundImageUrl?: string | null;
  logoUrl?: string | null;
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidBrandingHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeBrandingImageUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return raw;
  } catch {
    /* not a URL */
  }
  return null;
}

export function normalizeBrandingText(value: string | null | undefined, maxLength: number): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return raw.slice(0, maxLength);
}

export function buildTenantBrandingUpdate(
  body: TenantBrandingUpdateInput
): Partial<
  Pick<
    TenantBrandingRow,
    | "logo_url"
    | "primary_color"
    | "secondary_color"
    | "accent_color"
    | "welcome_headline"
    | "welcome_subtitle"
    | "auth_background_image_url"
  >
> {
  const patch: Partial<
    Pick<
      TenantBrandingRow,
      | "logo_url"
      | "primary_color"
      | "secondary_color"
      | "accent_color"
      | "welcome_headline"
      | "welcome_subtitle"
      | "auth_background_image_url"
    >
  > = {};

  if ("primaryColor" in body) {
    const value = body.primaryColor?.trim();
    if (value && !isValidBrandingHex(value)) {
      throw new Error("Primary color must be a valid hex code (example: #BC8B41).");
    }
    patch.primary_color = value || null;
  }

  if ("secondaryColor" in body) {
    const value = body.secondaryColor?.trim();
    if (value && !isValidBrandingHex(value)) {
      throw new Error("Secondary color must be a valid hex code (example: #104b83).");
    }
    patch.secondary_color = value || null;
  }

  if ("accentColor" in body) {
    const value = body.accentColor?.trim();
    if (value && !isValidBrandingHex(value)) {
      throw new Error("Accent color must be a valid hex code (example: #E9B771).");
    }
    patch.accent_color = value || null;
  }

  if ("welcomeHeadline" in body) {
    patch.welcome_headline = normalizeBrandingText(body.welcomeHeadline, 120);
  }

  if ("welcomeSubtitle" in body) {
    patch.welcome_subtitle = normalizeBrandingText(body.welcomeSubtitle, 200);
  }

  if ("authBackgroundImageUrl" in body) {
    const value = body.authBackgroundImageUrl?.trim();
    if (value && !normalizeBrandingImageUrl(value)) {
      throw new Error("Background image must be a valid web link or start with /.");
    }
    patch.auth_background_image_url = value ? normalizeBrandingImageUrl(value) : null;
  }

  if ("logoUrl" in body) {
    const value = body.logoUrl?.trim();
    if (value && !normalizeBrandingImageUrl(value)) {
      throw new Error("Logo must be a valid web link or start with /.");
    }
    patch.logo_url = value ? normalizeBrandingImageUrl(value) : null;
  }

  return patch;
}

export async function invalidateTenantBrandingCache(tenantId: string): Promise<void> {
  const { buildCacheKey, deleteCache } = await import("@/lib/cache");
  await deleteCache(
    buildCacheKey("tenants", ["tenant", tenantId, "branding"], {
      fields: "branding",
    })
  );
}
