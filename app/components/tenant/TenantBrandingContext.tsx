"use client";

import { createContext, useContext, useEffect } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { pushActiveBranding } from "@/lib/tenant/branding-head-registry";

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

  useEffect(
    () => pushActiveBranding(safe),
    [
      safe.slug,
      safe.logoUrl,
      safe.companyName,
      safe.primaryHex,
      safe.secondaryHex,
      safe.accentHex,
    ]
  );

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
