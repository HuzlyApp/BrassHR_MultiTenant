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
  const query = async (kind: string, value: string) => {
    const { data, error } = await supabase.rpc("public_tenant_branding", { p_kind: kind, p_value: value });
    if (error) throw error;
    return data as TenantBrandingRow | null;
  };
  let row = await query(lookup.kind === "default" ? "slug" : lookup.kind, lookup.kind === "default" ? PLATFORM_DEFAULT_TENANT_SLUG : lookup.value);
  if (!row && lookup.kind === "default") {
    const configured = getConfiguredDefaultTenantId();
    if (configured) row = await query("tenantId", configured);
  }
  return { row, resolvedSlug: row?.slug ?? (lookup.kind === "tenantId" ? null : lookup.kind === "default" ? PLATFORM_DEFAULT_TENANT_SLUG : lookup.value) };
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
