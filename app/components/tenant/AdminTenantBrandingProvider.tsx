"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Hydrates recruiter admin chrome with the scoped tenant branding (effective tenant —
 * recruiter home tenant or god-admin cookie).
 */
export function AdminTenantBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<TenantBranding>(() => defaultTenantBranding());

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const {
          data: { session },
        } = await supabaseBrowser.auth.getSession();
        const accessToken = session?.access_token ?? null;
        const res = await fetch("/api/admin/effective-branding", {
          cache: "no-store",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          branding?: TenantBranding;
          debug?: Record<string, unknown>;
        };
        const b = payload.branding;
        if (!alive || !b) return;
        setBranding(b);
        if (process.env.NODE_ENV !== "production") {
          console.info("[AdminTenantBrandingProvider] effective branding", payload.debug ?? payload);
        }
      } catch {
        /* keep default chrome */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return <TenantBrandingProvider branding={branding}>{children}</TenantBrandingProvider>;
}
