import { createClient as createSb } from "@supabase/supabase-js";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow } from "@/lib/tenant/tenant-branding";
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

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
    const { data } = await supabase
      .from("tenants")
      .select(
        "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    row = data ?? null;
  } else {
    const configured = getConfiguredDefaultTenantId();
    if (configured) {
      const { data } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
        )
        .eq("id", configured)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      row = data ?? null;
    }

    if (!row) {
      const { data } = await supabase
        .from("tenants")
        .select(
          "id, name, slug, logo_url, primary_color, secondary_color, accent_color, welcome_headline, welcome_subtitle, auth_background_image_url"
        )
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<TenantBrandingRow>();
      row = data ?? null;
    }
  }

  return Response.json({ branding: brandingFromTenantRow(row) });
}
