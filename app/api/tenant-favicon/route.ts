import { createClient as createSb } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import {
  brandingFallbackForSlug,
  brandingFromTenantRow,
  normalizeBrandingImageSrc,
  PLATFORM_DEFAULT_TENANT_SLUG,
} from "@/lib/tenant/tenant-branding";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

const TENANT_BRANDING_SELECT =
  "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url";

const DEFAULT_FAVICON = "/icons/braas-HR/BrassHR-logo.svg";

function toAbsoluteIconUrl(iconSrc: string, requestUrl: string): string {
  if (iconSrc.startsWith("http://") || iconSrc.startsWith("https://")) return iconSrc;
  return new URL(iconSrc, requestUrl).toString();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug")?.trim().toLowerCase();
  const subdomainParam = searchParams.get("subdomain")?.trim().toLowerCase();
  const resolvedSlug = slugParam || subdomainParam || PLATFORM_DEFAULT_TENANT_SLUG;

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  let branding = brandingFallbackForSlug(resolvedSlug);

  if (url && key) {
    const supabase = createSb(url, key);
    let row: TenantBrandingRow | null = null;

    if (subdomainParam && !slugParam) {
      const { data: bySub } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("subdomain", subdomainParam)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      row = bySub ?? null;
      if (!row) {
        const { data: bySlug } = await supabase
          .from("tenants")
          .select(TENANT_BRANDING_SELECT)
          .eq("slug", subdomainParam)
          .eq("is_active", true)
          .maybeSingle<TenantBrandingRow>();
        row = bySlug ?? null;
      }
    } else {
      const { data } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("slug", resolvedSlug)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      row = data ?? null;
    }

    branding = brandingFromTenantRow(row, resolvedSlug);
  }

  const fallback = brandingFallbackForSlug(branding.slug).logoUrl || DEFAULT_FAVICON;
  const iconSrc = normalizeBrandingImageSrc(branding.logoUrl, fallback, { allowBlob: true });
  const target = toAbsoluteIconUrl(iconSrc, req.url);

  return NextResponse.redirect(target, 302);
}
