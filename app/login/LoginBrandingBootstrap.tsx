"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

const LoginInitialBrandingContext = createContext<TenantBranding | null>(null);

export function LoginBrandingBootstrap({
  branding,
  children,
}: {
  branding: TenantBranding;
  children: ReactNode;
}) {
  return (
    <LoginInitialBrandingContext.Provider value={branding}>
      {children}
    </LoginInitialBrandingContext.Provider>
  );
}

export function useLoginInitialBranding(): TenantBranding | null {
  return useContext(LoginInitialBrandingContext);
}
