"use client";

import { createContext, useContext, useMemo } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { useEffectiveBranding } from "@/lib/admin/hooks/use-effective-branding";
import {
  hireJourneyThemeCssVars,
  resolveHireJourneyTheme,
  type ResolvedHireJourneyTheme,
} from "@/lib/tenant/hire-journey-theme";

const HireJourneyThemeContext = createContext<ResolvedHireJourneyTheme | null>(null);

export function useHireJourneyTheme(): ResolvedHireJourneyTheme | null {
  return useContext(HireJourneyThemeContext);
}

export function HireJourneyThemeProvider({ children }: { children: React.ReactNode }) {
  const branding = useTenantBranding();
  const { hireJourneyTheme: overrides } = useEffectiveBranding();

  const theme = useMemo(
    () =>
      resolveHireJourneyTheme(overrides, {
        primaryHex: branding.primaryHex,
        secondaryHex: branding.secondaryHex,
      }),
    [branding.primaryHex, branding.secondaryHex, overrides]
  );
  const style = hireJourneyThemeCssVars(theme) as React.CSSProperties;

  return (
    <HireJourneyThemeContext.Provider value={theme}>
      <div style={style}>{children}</div>
    </HireJourneyThemeContext.Provider>
  );
}
