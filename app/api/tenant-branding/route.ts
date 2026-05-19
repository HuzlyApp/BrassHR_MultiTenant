import { createClient as createSb } from "@supabase/supabase-js";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, PLATFORM_DEFAULT_TENANT_SLUG } from "@/lib/tenant/tenant-branding";
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

const TENANT_BRANDING_SELECT =
  "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url";

export async function GET(req: Request) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug")?.trim();

  const supabase = createSb(url, key);
  let row: TenantBrandingRow | null = null;

  if (slug) {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) {
      console.error("[tenant-branding] slug lookup", slug, error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    row = data ?? null;
  } else {
    const { data: platformDefault, error: platformErr } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("slug", PLATFORM_DEFAULT_TENANT_SLUG)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (platformErr) {
      console.error("[tenant-branding] platform default", platformErr.message);
      return Response.json({ error: platformErr.message }, { status: 500 });
    }
    row = platformDefault ?? null;

    const configured = getConfiguredDefaultTenantId();
    if (!row && configured) {
      const { data, error } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("id", configured)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      if (error) {
        console.error("[tenant-branding] configured tenant", error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
      row = data ?? null;
    }
  }

  const resolvedSlug = slug ?? PLATFORM_DEFAULT_TENANT_SLUG;
  return Response.json({ branding: brandingFromTenantRow(row, resolvedSlug) });
}
