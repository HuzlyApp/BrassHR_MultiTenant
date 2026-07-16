import {
  loadPublicTenantBranding,
  type PublicTenantBrandingLookup,
} from "@/lib/tenant/load-public-tenant-branding";
import {
  extractTenantSubdomainLabel,
  forwardedHostFromHeaders,
  getEffectiveRootDomain,
  isRootDomainHost,
} from "@/lib/tenant/tenant-host-resolution";
import { createPerfTimer, logPerf } from "@/lib/perf";

export async function GET(req: Request) {
  const routeTimer = createPerfTimer();
  const tenantResponseHeaders = {
    "Cache-Control": "private, no-store",
    Vary: "Host",
  };

  const rootDomain = getEffectiveRootDomain();
  const hostNorm = forwardedHostFromHeaders(req.headers);
  const hostSubdomain = hostNorm ? extractTenantSubdomainLabel(hostNorm, rootDomain) : null;
  const onRootDomain = Boolean(rootDomain && hostNorm && isRootDomainHost(hostNorm, rootDomain));

  const { searchParams } = new URL(req.url);
  const lookup: PublicTenantBrandingLookup = {
    hostSubdomain,
    onRootDomain,
    slug: searchParams.get("slug")?.trim() ?? null,
    tenantId: searchParams.get("tenantId")?.trim() ?? null,
    subdomain: searchParams.get("subdomain")?.trim().toLowerCase() ?? null,
  };

  try {
    const branding = await loadPublicTenantBranding(lookup);
    const tenantWasRequested = Boolean(
      lookup.hostSubdomain || lookup.slug || lookup.tenantId || lookup.subdomain
    );
    logPerf("GET /api/tenant-branding", {
      totalMs: routeTimer.elapsedMs(),
      lookup: hostSubdomain || lookup.subdomain || lookup.slug || lookup.tenantId || "default",
      host: hostNorm,
    });
    return Response.json(
      { branding, tenantFound: !tenantWasRequested || Boolean(branding.id) },
      { headers: tenantResponseHeaders }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tenant branding lookup failed";
    console.error("[tenant-branding]", msg);
    return Response.json({ error: msg }, { status: 500, headers: tenantResponseHeaders });
  }
}
