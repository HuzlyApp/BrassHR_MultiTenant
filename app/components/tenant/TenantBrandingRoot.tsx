"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  brandingFallbackForSlug,
  defaultTenantBranding,
  isTenantApplicantPortalSlug,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import {
  buildTenantBrandingApiUrl,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";

/** Default branding for routes without an explicit tenant context. */
export default function TenantBrandingRoot({ children }: { children: ReactNode }) {
  const [brandingReady, setBrandingReady] = useState(false);
  const [branding, setBranding] = useState<TenantBranding>(() => defaultTenantBranding());

  useEffect(() => {
    let alive = true;

    void (async () => {
      const pathname = window.location.pathname;
      const isRecruiterAuthEntry =
        pathname === "/admin" ||
        pathname.startsWith("/admin/") ||
        pathname === "/login" ||
        pathname.startsWith("/login/") ||
        pathname === "/signin" ||
        pathname.startsWith("/signin/");

      const resolved = resolveTenantSlugForClient(window.location.search, {
        path: pathname,
      });
      const tenantPortal = isTenantApplicantPortalSlug(resolved.slug);
      if (!tenantPortal || isRecruiterAuthEntry) {
        setBranding(brandingFallbackForSlug(resolved.slug));
        setBrandingReady(true);
      }

      try {
        const res = await fetch(buildTenantBrandingApiUrl(resolved), {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        const payload = (await res.json().catch(() => ({}))) as { branding?: TenantBranding };
        if (alive && payload.branding) {
          setBranding(payload.branding);
        }
      } catch {
        if (alive && tenantPortal) {
          setBranding(brandingFallbackForSlug(resolved.slug));
        }
      } finally {
        if (alive) setBrandingReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!brandingReady) {
    return <div className="min-h-screen bg-white" aria-hidden="true" />;
  }

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
