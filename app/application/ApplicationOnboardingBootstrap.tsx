"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import OnboardingConfigProvider from "@/app/components/onboarding/OnboardingConfigProvider";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { defaultTenantBranding } from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie, resolveClientOnboardingTenantSlug } from "@/lib/tenant/client-onboarding-slug";

/**
 * Runs before onboarding pages mount so `worker.user_id` FK to `auth.users` is satisfied,
 * and applies tenant-aware branding (`?tenant=slug`, onboarding slug cookie).
 */
export default function ApplicationOnboardingBootstrap({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const search = typeof window !== "undefined" ? window.location.search : "";
        const qp = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tenant") : null;

        const slug =
          qp != null && qp.trim().length >= 2 ? qp.trim().toLowerCase() : resolveClientOnboardingTenantSlug(search);

        if (slug) persistOnboardingSlugCookie(slug);

        const [tenantRes] = await Promise.all([
          fetch(slug ? `/api/tenant-branding?slug=${encodeURIComponent(slug)}` : "/api/tenant-branding", {
            cache: "no-store",
          }).catch(() => null),
        ]);

        if (alive && tenantRes?.ok) {
          const payload = (await tenantRes.json()) as { branding?: TenantBranding };
          if (payload.branding) setBrand(payload.branding);
        }

        if (pathname !== "/application/applicant-dashboard") {
          const { supabaseBrowser } = await import("@/lib/supabase-browser");
          const { ensureApplicantMatchesAuthSession } = await import("@/lib/onboarding/ensure-applicant-auth");
          const r = await ensureApplicantMatchesAuthSession(supabaseBrowser);
          if (!alive) return;

          if ("error" in r) setError(r.error);
        }
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

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
        Starting secure session…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-red-700">
        <p className="font-medium">Could not start onboarding session</p>
        <p className="mt-2 text-gray-700">{error}</p>
        <p className="mt-4 text-xs text-gray-500">
          In Supabase Dashboard, enable Anonymous Sign-In (Authentication → Providers). Then refresh this page.
        </p>
      </div>
    );
  }

  return (
    <TenantBrandingProvider branding={brand}>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
            Loading onboarding…
          </div>
        }
      >
        <OnboardingConfigProvider>{children}</OnboardingConfigProvider>
      </Suspense>
    </TenantBrandingProvider>
  );
}
