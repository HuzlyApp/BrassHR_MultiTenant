import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import {
  brandingFromTenantRow,
  isTenantApplicantPortalSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import {
  extractTenantSubdomainLabel,
  forwardedHostFromHeaders,
  getEffectiveRootDomain,
  isRootDomainHost,
} from "@/lib/tenant/tenant-host-resolution";

export type PublicTenantBrandingLookup = {
  hostSubdomain?: string | null;
  slug?: string | null;
  tenantId?: string | null;
  subdomain?: string | null;
  onRootDomain?: boolean;
};

async function loadTenantBrandingRow(
  supabase: SupabaseClient,
  lookup: { kind: "slug" | "tenantId" | "subdomain" | "default"; value: string }
): Promise<{ row: TenantBrandingRow | null; resolvedSlug: string | null }> {
  if (lookup.kind === "subdomain") {
    const label = lookup.value;
    const { data: bySub, error: subErr } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("subdomain", label)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (subErr) throw subErr;
    if (bySub) return { row: bySub, resolvedSlug: bySub.slug };

    const { data: bySlug, error: slugErr } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("slug", label)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (slugErr) throw slugErr;
    return { row: bySlug ?? null, resolvedSlug: bySlug?.slug ?? label };
  }

  if (lookup.kind === "slug") {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("slug", lookup.value)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) throw error;
    return { row: data ?? null, resolvedSlug: lookup.value };
  }

  if (lookup.kind === "tenantId") {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("id", lookup.value)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) throw error;
    return { row: data ?? null, resolvedSlug: data?.slug ?? null };
  }

  const { data: platformDefault, error: platformErr } = await supabase
    .from("tenants")
    .select(TENANT_BRANDING_SELECT)
    .eq("slug", PLATFORM_DEFAULT_TENANT_SLUG)
    .eq("is_active", true)
    .maybeSingle<TenantBrandingRow>();
  if (platformErr) throw platformErr;
  let row = platformDefault ?? null;
  const configured = getConfiguredDefaultTenantId();
  if (!row && configured) {
    const { data, error } = await supabase
      .from("tenants")
      .select(TENANT_BRANDING_SELECT)
      .eq("id", configured)
      .eq("is_active", true)
      .maybeSingle<TenantBrandingRow>();
    if (error) throw error;
    row = data ?? null;
  }
  return { row, resolvedSlug: row?.slug ?? PLATFORM_DEFAULT_TENANT_SLUG };
}

export async function loadPublicTenantBranding(
  lookup: PublicTenantBrandingLookup
): Promise<TenantBranding> {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return brandingFromTenantRow(null, lookup.slug ?? PLATFORM_DEFAULT_TENANT_SLUG);
  }

  const supabase = createSb(url, key);
  const slugParam = lookup.slug?.trim() ?? null;
  const tenantIdParam = lookup.tenantId?.trim() ?? null;
  const subdomainParam = lookup.subdomain?.trim().toLowerCase() ?? null;
  const hostSubdomain = lookup.hostSubdomain?.trim().toLowerCase() ?? null;

  let resolvedSlug = slugParam;
  let row: TenantBrandingRow | null = null;

  if (hostSubdomain && !slugParam) {
    const loaded = await loadTenantBrandingRow(supabase, {
      kind: "subdomain",
      value: hostSubdomain,
    });
    row = loaded.row;
    resolvedSlug = loaded.resolvedSlug;
  } else if (subdomainParam && !slugParam) {
    const loaded = await loadTenantBrandingRow(supabase, {
      kind: "subdomain",
      value: subdomainParam,
    });
    row = loaded.row;
    resolvedSlug = loaded.resolvedSlug;
  } else if (slugParam) {
    const loaded = await loadTenantBrandingRow(supabase, { kind: "slug", value: slugParam });
    row = loaded.row;
    resolvedSlug = loaded.resolvedSlug;
  } else if (tenantIdParam) {
    const loaded = await loadTenantBrandingRow(supabase, { kind: "tenantId", value: tenantIdParam });
    row = loaded.row;
    resolvedSlug = loaded.resolvedSlug;
  } else {
    const loaded = await loadTenantBrandingRow(supabase, { kind: "default", value: "platform" });
    row = loaded.row;
    resolvedSlug = loaded.resolvedSlug;
  }

  const brandingSlug = resolvedSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;
  return brandingFromTenantRow(row, brandingSlug);
}

export async function loadPublicTenantBrandingFromHeaders(
  headers: Headers
): Promise<TenantBranding> {
  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(headers);
  const hostSubdomain = hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;
  const onRootDomain = Boolean(rootDomain && hostNorm && isRootDomainHost(hostNorm, rootDomain));

  return loadPublicTenantBranding({
    hostSubdomain,
    onRootDomain,
  });
}

/** Auth surfaces (`/admin`, `/login`) — hostname wins, then ?tenant=, then onboarding cookie. */
export async function loadAuthTenantBranding(options: {
  headers: Headers;
  tenantSlugFromQuery?: string | null;
  tenantSlugFromCookie?: string | null;
}): Promise<TenantBranding> {
  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(options.headers);
  const hostSubdomain = hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;

  if (hostSubdomain) {
    return loadPublicTenantBranding({ hostSubdomain });
  }

  const fromQuery = options.tenantSlugFromQuery?.trim().toLowerCase() ?? "";
  if (fromQuery.length >= 2) {
    return loadPublicTenantBranding({ slug: fromQuery });
  }

  const fromCookie = options.tenantSlugFromCookie?.trim().toLowerCase() ?? "";
  if (fromCookie.length >= 2 && isTenantApplicantPortalSlug(fromCookie)) {
    return loadPublicTenantBranding({ slug: fromCookie });
  }

  const onRootDomain = Boolean(rootDomain && hostNorm && isRootDomainHost(hostNorm, rootDomain));
  return loadPublicTenantBranding({ onRootDomain });
}
