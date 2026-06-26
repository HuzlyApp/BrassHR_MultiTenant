import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { normalizeBrandingFontId } from "@/lib/tenant/tenant-branding";
import { isValidBrandingHex } from "@/lib/tenant/branding-validation";

export const TENANT_BRANDING_SELECT =
  "id, name, slug, logo_url, login_logo_url, signup_logo_url, primary_color, secondary_color, accent_color, checkbox_color, welcome_headline, welcome_subtitle, signup_headline, signup_subheadline, auth_background_image_url, primary_font, heading_font, body_font, font_color, heading_color, muted_text_color, button_text, button_color";

export type TenantBrandingUpdateInput = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  welcomeHeadline?: string | null;
  welcomeSubtitle?: string | null;
  signupHeadline?: string | null;
  signupSubheadline?: string | null;
  authBackgroundImageUrl?: string | null;
  logoUrl?: string | null;
  loginLogoUrl?: string | null;
  signupLogoUrl?: string | null;
  primaryFont?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
  fontColor?: string | null;
  headingColor?: string | null;
  mutedTextColor?: string | null;
  buttonText?: string | null;
  buttonColor?: string | null;
};

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

type BrandingPatch = Partial<
  Pick<
    TenantBrandingRow,
    | "logo_url"
    | "login_logo_url"
    | "signup_logo_url"
    | "primary_color"
    | "secondary_color"
    | "accent_color"
    | "welcome_headline"
    | "welcome_subtitle"
    | "signup_headline"
    | "signup_subheadline"
    | "auth_background_image_url"
    | "primary_font"
    | "heading_font"
    | "body_font"
    | "font_color"
    | "heading_color"
    | "muted_text_color"
    | "button_text"
    | "button_color"
  >
>;

function patchHexField(
  patch: BrandingPatch,
  key: keyof BrandingPatch,
  value: string | null | undefined,
  label: string
) {
  if (value === undefined) return;
  const trimmed = value?.trim();
  if (trimmed && !isValidBrandingHex(trimmed)) {
    throw new Error(`${label} must be a valid hex code (example: #BC8B41).`);
  }
  patch[key] = trimmed || null;
}

export function buildTenantBrandingUpdate(body: TenantBrandingUpdateInput): BrandingPatch {
  const patch: BrandingPatch = {};

  patchHexField(patch, "primary_color", body.primaryColor, "Primary color");
  patchHexField(patch, "secondary_color", body.secondaryColor, "Secondary color");
  patchHexField(patch, "accent_color", body.accentColor, "Accent color");
  patchHexField(patch, "font_color", body.fontColor, "Font color");
  patchHexField(patch, "heading_color", body.headingColor, "Heading color");
  patchHexField(patch, "muted_text_color", body.mutedTextColor, "Muted text color");
  patchHexField(patch, "button_color", body.buttonColor, "Button color");

  if ("welcomeHeadline" in body) {
    patch.welcome_headline = normalizeBrandingText(body.welcomeHeadline, 120);
  }
  if ("welcomeSubtitle" in body) {
    patch.welcome_subtitle = normalizeBrandingText(body.welcomeSubtitle, 200);
  }
  if ("signupHeadline" in body) {
    patch.signup_headline = normalizeBrandingText(body.signupHeadline, 120);
  }
  if ("signupSubheadline" in body) {
    patch.signup_subheadline = normalizeBrandingText(body.signupSubheadline, 200);
  }
  if ("buttonText" in body) {
    patch.button_text = normalizeBrandingText(body.buttonText, 40);
  }

  if ("authBackgroundImageUrl" in body) {
    const value = body.authBackgroundImageUrl?.trim();
    if (value && !normalizeBrandingImageUrl(value)) {
      throw new Error("Background image must be a valid web link or start with /.");
    }
    patch.auth_background_image_url = value ? normalizeBrandingImageUrl(value) : null;
  }

  for (const [inputKey, columnKey] of [
    ["logoUrl", "logo_url"],
    ["loginLogoUrl", "login_logo_url"],
    ["signupLogoUrl", "signup_logo_url"],
  ] as const) {
    if (inputKey in body) {
      const value = body[inputKey]?.trim();
      if (value && !normalizeBrandingImageUrl(value)) {
        throw new Error("Logo must be a valid web link or start with /.");
      }
      patch[columnKey] = value ? normalizeBrandingImageUrl(value) : null;
    }
  }

  if ("primaryFont" in body) {
    patch.primary_font = body.primaryFont ? normalizeBrandingFontId(body.primaryFont) : null;
  }
  if ("headingFont" in body) {
    patch.heading_font = body.headingFont ? normalizeBrandingFontId(body.headingFont) : null;
  }
  if ("bodyFont" in body) {
    patch.body_font = body.bodyFont ? normalizeBrandingFontId(body.bodyFont) : null;
  }

  return patch;
}
