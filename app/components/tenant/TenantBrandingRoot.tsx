"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { BRANDING_UPDATED_EVENT } from "@/lib/tenant/branding-events";
import { isRecruiterAuthPath } from "@/lib/tenant/auth-entry-paths";
import { readCachedTenantBranding, writeCachedTenantBranding } from "@/lib/tenant/client-branding-cache";
import { fetchTenantBranding } from "@/lib/tenant/fetch-tenant-branding";
import {
  buildTenantBrandingApiUrl,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";
import { hostnameStorageKey } from "@/lib/tenant/scoped-storage";
import {
  brandingFallbackForSlug,
  defaultTenantBranding,
  isTenantApplicantPortalSlug,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

const BRANDING_CACHE_STORAGE_KEY = "tenantBrandingV1";

/** Default branding for routes without an explicit tenant context. */
export default function TenantBrandingRoot({ children }: { children: ReactNode }) {
  // Keep SSR/client first paint identical — never read window/localStorage in useState.
  const [branding, setBranding] = useState<TenantBranding>(() => defaultTenantBranding());

  const refreshBranding = useCallback(async (opts?: { preferCache?: boolean }) => {
    const cached = readCachedTenantBranding();
    if (opts?.preferCache && cached) {
      setBranding(cached);
    }

    const currentPath = window.location.pathname;
    const recruiterAuthEntry = isRecruiterAuthPath(currentPath);
    const resolved = resolveTenantSlugForClient(window.location.search, {
      path: currentPath,
    });
    const tenantPortal = isTenantApplicantPortalSlug(resolved.slug);

    if (!cached && !(recruiterAuthEntry && tenantPortal)) {
      // Tenant careers/jobs surfaces: never leave platform Brass HR gold while loading.
      setBranding(brandingFallbackForSlug(resolved.slug));
    }

    try {
      const payload = await fetchTenantBranding(buildTenantBrandingApiUrl(resolved));
      if (payload.branding) {
        setBranding(payload.branding);
        writeCachedTenantBranding(payload.branding);
      }
    } catch {
      if (tenantPortal && !cached) {
        setBranding(brandingFallbackForSlug(resolved.slug));
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const cached = readCachedTenantBranding();
      if (cached && alive) setBranding(cached);

      const currentPath = window.location.pathname;
      const recruiterAuthEntry = isRecruiterAuthPath(currentPath);
      const resolved = resolveTenantSlugForClient(window.location.search, {
        path: currentPath,
      });
      const tenantPortal = isTenantApplicantPortalSlug(resolved.slug);

      if (!cached) {
        if (recruiterAuthEntry && tenantPortal) {
          // Tenant admin login — wait for API; login layout paints the shell.
        } else if (alive) {
          setBranding(brandingFallbackForSlug(resolved.slug));
        }
      }

      try {
        const payload = await fetchTenantBranding(buildTenantBrandingApiUrl(resolved));
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

    const onBrandingUpdated = () => {
      void refreshBranding({ preferCache: true });
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key !== hostnameStorageKey(BRANDING_CACHE_STORAGE_KEY)) return;
      const cached = readCachedTenantBranding();
      if (cached) setBranding(cached);
      else void refreshBranding();
    };

    window.addEventListener(BRANDING_UPDATED_EVENT, onBrandingUpdated);
    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      window.removeEventListener(BRANDING_UPDATED_EVENT, onBrandingUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshBranding]);

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
