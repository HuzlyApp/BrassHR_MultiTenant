"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { isRecruiterAuthPath } from "@/lib/tenant/auth-entry-paths";
import { readCachedTenantBranding, writeCachedTenantBranding } from "@/lib/tenant/client-branding-cache";
import {
  buildTenantBrandingApiUrl,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";
import {
  brandingFallbackForSlug,
  defaultTenantBranding,
  isTenantApplicantPortalSlug,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

/** Default branding for routes without an explicit tenant context. */
export default function TenantBrandingRoot({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding>(defaultTenantBranding);

  useEffect(() => {
    let alive = true;
    const cached = readCachedTenantBranding();
    if (cached) {
      setBranding(cached);
    }

    void (async () => {
      const currentPath = window.location.pathname;
      const recruiterAuthEntry = isRecruiterAuthPath(currentPath);
      const resolved = resolveTenantSlugForClient(window.location.search, {
        path: currentPath,
      });
      const tenantPortal = isTenantApplicantPortalSlug(resolved.slug);

      if (!cached) {
        if (recruiterAuthEntry && tenantPortal) {
          // Tenant admin login — wait for API; login layout paints the shell.
        } else if (!tenantPortal || recruiterAuthEntry) {
          setBranding(brandingFallbackForSlug(resolved.slug));
        }
      }

      try {
        const res = await fetch(buildTenantBrandingApiUrl(resolved), {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        const payload = (await res.json().catch(() => ({}))) as { branding?: TenantBranding };
        if (alive && payload.branding) {
          setBranding(payload.branding);
          writeCachedTenantBranding(payload.branding);
        }
      } catch {
        if (alive && tenantPortal && !cached) {
          setBranding(brandingFallbackForSlug(resolved.slug));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
