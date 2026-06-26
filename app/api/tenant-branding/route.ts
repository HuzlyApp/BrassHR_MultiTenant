import { createClient as createSb } from "@supabase/supabase-js";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, PLATFORM_DEFAULT_TENANT_SLUG } from "@/lib/tenant/tenant-branding";
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";

export async function GET(req: Request) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug")?.trim();
  const tenantIdParam = searchParams.get("tenantId")?.trim();
  const subdomainParam = searchParams.get("subdomain")?.trim().toLowerCase();

  const supabase = createSb(url, key);
  let row: TenantBrandingRow | null = null;
  let resolvedSlug = slugParam ?? null;

  if (subdomainParam && !slugParam) {
    const { data: bySub, error: subErr } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("subdomain", subdomainParam)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (subErr) {
      console.error("[tenant-branding] subdomain lookup", subdomainParam, subErr.message);
      return Response.json({ error: subErr.message }, { status: 500 });
    }
    if (bySub) {
      row = bySub;
      resolvedSlug = bySub.slug;
    } else {
      const { data: bySlug, error: slugErr } = await supabase
        .from("tenants")
        .select(TENANT_BRANDING_SELECT)
        .eq("slug", subdomainParam)
        .eq("is_active", true)
        .maybeSingle<TenantBrandingRow>();
      if (slugErr) {
        console.error("[tenant-branding] subdomain-as-slug lookup", subdomainParam, slugErr.message);
        return Response.json({ error: slugErr.message }, { status: 500 });
      }
      row = bySlug ?? null;
      resolvedSlug = bySlug?.slug ?? subdomainParam;
    }
  } else if (slugParam) {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("slug", slugParam)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) {
      console.error("[tenant-branding] slug lookup", slugParam, error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    row = data ?? null;
  } else if (tenantIdParam) {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("id", tenantIdParam)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) {
      console.error("[tenant-branding] tenantId lookup", tenantIdParam, error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    row = data ?? null;
    resolvedSlug = data?.slug ?? null;
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

  const brandingSlug = resolvedSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;
  return Response.json({ branding: brandingFromTenantRow(row, brandingSlug) });
}
