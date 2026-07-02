"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { applyBrandingHead } from "@/lib/tenant/apply-branding-head";
import {
  getActiveBranding,
  pushActiveBranding,
  subscribeActiveBranding,
} from "@/lib/tenant/branding-head-registry";

const TenantBrandingContext = createContext<TenantBranding>(defaultTenantBranding());

export function TenantBrandingProvider({
  branding,
  children,
}: {
  branding?: TenantBranding | null;
  children: React.ReactNode;
}) {
  const safe = branding ?? defaultTenantBranding();
  const vars = brandingToCssVars(safe) as React.CSSProperties;

  useLayoutEffect(() => {
    const pop = pushActiveBranding(safe);

    const syncHead = () => {
      if (getActiveBranding() === safe) {
        applyBrandingHead(safe);
      }
    };

    syncHead();
    const unsubscribe = subscribeActiveBranding(syncHead);

    return () => {
      unsubscribe();
      pop();
    };
  }, [
    safe.slug,
    safe.logoUrl,
    safe.companyName,
    safe.primaryHex,
    safe.secondaryHex,
    safe.accentHex,
  ]);

  return (
    <TenantBrandingContext.Provider value={safe}>
      <div className="min-h-0" style={vars}>
        {children}
      </div>
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding {
  return useContext(TenantBrandingContext);
}
