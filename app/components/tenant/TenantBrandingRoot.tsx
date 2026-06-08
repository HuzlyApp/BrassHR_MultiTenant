"use client";

import { useMemo, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";

/** Default branding for routes without an explicit tenant context. */
export default function TenantBrandingRoot({ children }: { children: ReactNode }) {
  const branding = useMemo(() => defaultTenantBranding(), []);

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
