"use client";

import { createContext, useContext } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";

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
