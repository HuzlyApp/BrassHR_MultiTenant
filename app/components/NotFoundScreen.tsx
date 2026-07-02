"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  buildTenantBrandingApiUrl,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";
import {
  brandingFallbackForSlug,
  brandingToCssVars,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

export default function NotFoundScreen() {
  const [brand, setBrand] = useState<TenantBranding>(() =>
    brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG)
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const resolved = resolveTenantSlugForClient(window.location.search, {
        path: window.location.pathname,
      });
      const brandingSlug = resolved.slug ?? PLATFORM_DEFAULT_TENANT_SLUG;

      try {
        const res = await fetch(buildTenantBrandingApiUrl(resolved), {
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
        else if (alive) setBrand(brandingFallbackForSlug(brandingSlug));
      } catch {
        if (alive) setBrand(brandingFallbackForSlug(brandingSlug));
      } finally {
        if (alive) setReady(true);
      }
    })();

    const timer = window.setTimeout(() => {
      if (alive) setReady(true);
    }, 12_000);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const shellStyle: CSSProperties = {
    ...brandingToCssVars(brand),
    background: `linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)`,
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-base text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        style={shellStyle}
        className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8"
      >
        <section className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white px-6 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:px-10 sm:py-12">
          <p
            className="text-[56px] font-bold leading-none tracking-tight sm:text-[72px]"
            style={{ color: "var(--brand-primary)" }}
          >
            404
          </p>

          <h1 className="mt-4 text-[26px] font-semibold leading-8 text-slate-900 sm:text-[32px] sm:leading-10">
            Page not found
          </h1>

          <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-6 text-slate-500 sm:text-[16px]">
            This link is wrong or the page was moved. Go back to the home page.
          </p>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
