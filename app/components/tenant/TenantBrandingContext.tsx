"use client";

import { createContext, useContext, useLayoutEffect } from "react";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingToCssVars, defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { applyBrandingHead } from "@/lib/tenant/apply-branding-head";
import {
  applyBrandingTypography,
  clearBrandingTypography,
} from "@/lib/tenant/apply-branding-typography";
import {
  getActiveBranding,
  pushActiveBranding,
  subscribeActiveBranding,
} from "@/lib/tenant/branding-head-registry";

const TenantBrandingContext = createContext<TenantBranding>(defaultTenantBranding());

function brandingTypographyKey(branding: TenantBranding): string {
  return [
    branding.slug,
    branding.primaryFontId,
    branding.headingFontId,
    branding.bodyFontId,
    branding.baseFontSizeId,
    branding.fontColor,
    branding.headingColor,
    branding.mutedTextColor,
    branding.primaryHex,
    branding.secondaryHex,
    branding.accentHex,
    branding.logoUrl,
    branding.faviconUrl,
    branding.companyName,
    branding.headline,
    branding.subtitle,
  ].join("|");
}

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

    const syncDocument = () => {
      const active = getActiveBranding();
      if (active !== safe) return;
      applyBrandingHead(safe);
      applyBrandingTypography(safe);
    };

    syncDocument();
    const unsubscribe = subscribeActiveBranding(syncDocument);

    return () => {
      unsubscribe();
      pop();
      if (!getActiveBranding()) {
        clearBrandingTypography();
      } else {
        const next = getActiveBranding();
        if (next) {
          applyBrandingHead(next);
          applyBrandingTypography(next);
        }
      }
    };
    // Intentional: key captures all typography + chrome fields that must re-apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandingTypographyKey(safe)]);

  return (
    <TenantBrandingContext.Provider value={safe}>
      <div className="tenant-branded-surface min-h-0" style={vars}>
        {children}
      </div>
    </TenantBrandingContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding {
  return useContext(TenantBrandingContext);
}
