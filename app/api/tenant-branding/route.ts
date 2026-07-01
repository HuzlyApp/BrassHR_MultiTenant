import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";
import type { TenantBrandingRow } from "@/lib/tenant/tenant-branding";
import { brandingFromTenantRow, PLATFORM_DEFAULT_TENANT_SLUG } from "@/lib/tenant/tenant-branding";
import { getConfiguredDefaultTenantId } from "@/lib/tenant/resolve-default-tenant-id";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";
import { TENANT_BRANDING_SELECT } from "@/lib/tenant/branding-fields";
import {
  forwardedHostFromHeaders,
  getRootDomainFromEnv,
  extractTenantSubdomainLabel,
  isRootDomainHost,
} from "@/lib/tenant/tenant-host-resolution";
import { buildCacheKey, CACHE_TTL_SECONDS, getOrSetCache } from "@/lib/cache";
import { createPerfTimer, logPerf } from "@/lib/perf";

async function loadTenantBrandingRow(
  supabase: SupabaseClient,
  lookup: { kind: "slug" | "tenantId" | "subdomain" | "default"; value: string },
): Promise<{ row: TenantBrandingRow | null; resolvedSlug: string | null }> {
  const cacheKey = buildCacheKey("tenant_branding", [lookup.kind, lookup.value], {
    fields: TENANT_BRANDING_SELECT,
  });

  return getOrSetCache(
    cacheKey,
    async () => {
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
    },
    CACHE_TTL_SECONDS.tenantConfig,
  );
}

export async function GET(req: Request) {
  const routeTimer = createPerfTimer();
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const tenantResponseHeaders = {
    "Cache-Control": "private, no-store",
    Vary: "Host",
  };

  const rootDomain = getRootDomainFromEnv();
  const hostNorm = forwardedHostFromHeaders(req.headers);
  const hostSubdomain =
    rootDomain && hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;
  const onRootDomain =
    Boolean(rootDomain && hostNorm && isRootDomainHost(hostNorm, rootDomain));

  const { searchParams } = new URL(req.url);
  const slugParam = searchParams.get("slug")?.trim();
  const tenantIdParam = searchParams.get("tenantId")?.trim();
  const subdomainParam = searchParams.get("subdomain")?.trim().toLowerCase();

  const supabase = createSb(url, key);
  let resolvedSlug = slugParam ?? null;
  let row: TenantBrandingRow | null = null;

  try {
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
    } else if (onRootDomain) {
      const loaded = await loadTenantBrandingRow(supabase, { kind: "default", value: "platform" });
      row = loaded.row;
      resolvedSlug = loaded.resolvedSlug;
    } else {
      const loaded = await loadTenantBrandingRow(supabase, { kind: "default", value: "platform" });
      row = loaded.row;
      resolvedSlug = loaded.resolvedSlug;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tenant branding lookup failed";
    console.error("[tenant-branding]", msg);
    return Response.json({ error: msg }, { status: 500, headers: tenantResponseHeaders });
  }

  const brandingSlug = resolvedSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;
  logPerf("GET /api/tenant-branding", {
    totalMs: routeTimer.elapsedMs(),
    lookup: hostSubdomain || subdomainParam || slugParam || tenantIdParam || "default",
    host: hostNorm,
  });
  return Response.json(
    { branding: brandingFromTenantRow(row, brandingSlug) },
    { headers: tenantResponseHeaders }
  );
}
