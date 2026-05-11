"use client";

import { createContext, useContext } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";

const TenantBrandingContext = createContext<TenantBranding>(defaultTenantBranding());

export function TenantBrandingProvider({
  branding,
  children,
}: {
  branding: TenantBranding;
  children: React.ReactNode;
}) {
  const vars = brandingToCssVars(branding) as React.CSSProperties;
  return (
    <TenantBrandingContext.Provider value={branding}>
      <div className="min-h-0" style={vars}>
        {children}
      </div>
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding {
  return useContext(TenantBrandingContext);
}
