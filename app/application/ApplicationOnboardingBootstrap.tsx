"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import OnboardingLoader from "@/app/components/OnboardingLoader";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import OnboardingConfigProvider from "@/app/components/onboarding/OnboardingConfigProvider";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingFallbackForSlug } from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie, resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";

function resolveBootstrapSlug(): string | null {
  if (typeof window === "undefined") return null;
  const qp = new URLSearchParams(window.location.search).get("tenant")?.trim();
  if (qp && qp.length >= 2) return qp.toLowerCase();
  return resolveClientOnboardingTenantSlug(window.location.search);
}

/** Plain loader — no tenant colors until API branding is ready (avoids Braas gold flash). */
function BootstrapNeutralLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="flex min-w-[260px] flex-col items-center gap-4 rounded-2xl bg-white px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500" />
        <p className="text-center text-[15px] font-semibold leading-6 text-slate-800">
          Starting secure session…
        </p>
      </div>
    </div>
  );
}

/**
 * Runs before onboarding pages mount so `worker.user_id` FK to `auth.users` is satisfied,
 * and applies tenant-aware branding (`?tenant=slug`, onboarding slug cookie).
 */
export default function ApplicationOnboardingBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [brandingReady, setBrandingReady] = useState(false);
  const [brand, setBrand] = useState<TenantBranding | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const slug = resolveBootstrapSlug();
        if (slug) persistOnboardingSlugCookie(slug);

        const brandingUrl = slug
          ? `/api/tenant-branding?slug=${encodeURIComponent(slug)}`
          : "/api/tenant-branding";

        const brandingPromise = fetch(brandingUrl, { cache: "no-store" })
          .then(async (tenantRes) => {
            if (!alive || !tenantRes?.ok) return null;
            const payload = (await tenantRes.json()) as { branding?: TenantBranding };
            return payload.branding ?? null;
          })
          .catch(() => null)
          .then((resolved) => {
            if (!alive) return;
            setBrand(resolved ?? brandingFallbackForSlug(slug));
            setBrandingReady(true);
          });

        const authPromise =
          pathname !== "/application/applicant-dashboard"
            ? (async () => {
                const { supabaseBrowser } = await import("@/lib/supabase-browser");
                const { ensureApplicantMatchesAuthSession } = await import(
                  "@/lib/onboarding/ensure-applicant-auth"
                );
                return ensureApplicantMatchesAuthSession(supabaseBrowser);
              })()
            : Promise.resolve({ ok: true as const });

        await brandingPromise;

        const authResult = await authPromise;
        if (!alive) return;

        if (authResult && "error" in authResult) setError(authResult.error);
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Could not start applicant session.");
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!brandingReady || !brand) {
    return <BootstrapNeutralLoader />;
  }

  if (!ready) {
    return (
      <TenantBrandingProvider branding={brand}>
        <OnboardingLoader label="Starting secure session…" />
      </TenantBrandingProvider>
    );
  }

  if (error) {
    return (
      <TenantBrandingProvider branding={brand}>
        <div className="mx-auto max-w-lg p-8 text-center text-sm text-red-700">
          <p className="font-medium">Could not start onboarding session</p>
          <p className="mt-2 text-gray-700">{error}</p>
          <p className="mt-4 text-xs text-gray-500">
            In Supabase Dashboard, enable Anonymous Sign-In (Authentication → Providers). Then refresh
            this page.
          </p>
        </div>
      </TenantBrandingProvider>
    );
  }

  return (
    <TenantBrandingProvider branding={brand}>
      <Suspense fallback={<OnboardingLoader label="Loading onboarding…" />}>
        <OnboardingConfigProvider>{children}</OnboardingConfigProvider>
      </Suspense>
    </TenantBrandingProvider>
  );
}
