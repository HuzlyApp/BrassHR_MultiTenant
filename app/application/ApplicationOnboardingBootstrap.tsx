"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import OnboardingConfigProvider from "@/app/components/onboarding/OnboardingConfigProvider";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";
import { brandingFallbackForSlug, isTenantApplicantPortalSlug } from "@/lib/tenant/tenant-branding";
import { applyBrandingHead } from "@/lib/tenant/apply-branding-head";
import { DRAFT_PREVIEW_APPLICANT_ID, isOnboardingDraftPreview } from "@/lib/onboarding/is-draft-preview";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";
import {
  buildTenantBrandingApiUrl,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";
import { getScopedApplicantId, setScopedApplicantId } from "@/lib/tenant/scoped-storage";
import { ApplicantSessionProvider } from "@/lib/onboarding/applicant-session-context";

function resolveBootstrapSlug(): string | null {
  if (typeof window === "undefined") return null;
  return resolveTenantSlugForClient(window.location.search, {
    path: window.location.pathname,
  }).slug;
}

function readApplicantIdOrPreview(): string {
  if (isOnboardingDraftPreview(window.location.search)) {
    return DRAFT_PREVIEW_APPLICANT_ID;
  }
  return getScopedApplicantId() || "";
}

/**
 * Runs before onboarding pages mount so `worker.user_id` FK to `auth.users` is satisfied,
 * and applies tenant-aware branding (`?tenant=slug`, onboarding slug cookie).
 */
export default function ApplicationOnboardingBootstrap({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<TenantBranding>(() => brandingFallbackForSlug(null));
  const [brandingReady, setBrandingReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const resolved = resolveTenantSlugForClient(window.location.search, {
          path: window.location.pathname,
        });
        const slug = resolved.slug;
        const tenantPortal = isTenantApplicantPortalSlug(slug);
        if (slug) persistOnboardingSlugCookie(slug);

        if (alive && !tenantPortal) {
          setBrand(brandingFallbackForSlug(slug));
          setBrandingReady(true);
        }

        const brandingUrl = buildTenantBrandingApiUrl(resolved);

        const brandingPromise = fetch(brandingUrl, { cache: "no-store" })
          .then(async (tenantRes) => {
            if (!alive || !tenantRes?.ok) return null;
            const payload = (await tenantRes.json()) as { branding?: TenantBranding };
            return payload.branding ?? null;
          })
          .catch(() => null)
          .then((resolved) => {
            if (!alive || !resolved) return;
            setBrand(resolved);
          });

        const skipApplicantAuth =
          window.location.pathname.startsWith("/application/applicant-dashboard") ||
          window.location.pathname.startsWith("/application/home") ||
          isOnboardingDraftPreview(window.location.search);

        if (skipApplicantAuth && isOnboardingDraftPreview(window.location.search)) {
          setScopedApplicantId(DRAFT_PREVIEW_APPLICANT_ID);
        }

        const authPromise = skipApplicantAuth
          ? Promise.resolve({ applicantId: readApplicantIdOrPreview() } as const)
          : (async () => {
              const { ensureApplicantMatchesAuthSession } = await import(
                "@/lib/onboarding/ensure-applicant-auth"
              );
              return ensureApplicantMatchesAuthSession();
            })();

        await brandingPromise;

        const authResult = await authPromise;
        if (!alive) return;

        if (authResult && "error" in authResult) {
          setError(authResult.error);
        } else {
          setSessionReady(true);

          const params = new URLSearchParams(window.location.search);
          const jobId = params.get("job_id");
          const jobToken = params.get("job_token");
          const slug = resolveBootstrapSlug();
          const applicantId = getScopedApplicantId();
          if (slug && applicantId && (jobId || jobToken)) {
            await fetch("/api/onboarding/bind-job", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                applicantId,
                tenantSlug: slug,
                jobId,
                jobToken,
              }),
            }).catch(() => null);
          }
        }
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Could not start applicant session.");
      } finally {
        if (alive) {
          setSessionLoading(false);
          setBrandingReady(true);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (brandingReady) {
      applyBrandingHead(brand);
    }
  }, [brandingReady, brand.slug, brand.companyName, brand.logoUrl]);

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

  if (!brandingReady) {
    return <div className="min-h-screen bg-white" aria-hidden="true" />;
  }

  return (
    <TenantBrandingProvider branding={brand}>
      <ApplicantSessionProvider value={{ sessionReady, sessionLoading }}>
        <Suspense fallback={null}>
          <OnboardingConfigProvider>{children}</OnboardingConfigProvider>
        </Suspense>
      </ApplicantSessionProvider>
    </TenantBrandingProvider>
  );
}
