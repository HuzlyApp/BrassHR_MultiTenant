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
import { restartPublicApplyAsSomeoneElse } from "@/lib/onboarding/restart-public-apply-session";

function shouldOfferApplyAsSomeoneElse(pathname: string, search: string): boolean {
  if (isOnboardingDraftPreview(search)) return false;
  if (
    pathname.startsWith("/application/applicant-dashboard") ||
    pathname.startsWith("/application/home") ||
    pathname.startsWith("/application/candidate") ||
    pathname.startsWith("/application/application-status")
  ) {
    return false;
  }
  if (!pathname.startsWith("/application")) return false;
  const params = new URLSearchParams(search);
  if (params.get("applicationId")?.trim()) return false;
  if (!getScopedApplicantId()) return false;
  return Boolean(params.get("job_token")?.trim() || params.get("jobToken")?.trim());
}

function ApplicantApplyAsSomeoneElseBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(shouldOfferApplyAsSomeoneElse(window.location.pathname, window.location.search));
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950 sm:text-sm">
      <span className="font-medium">Continuing as a previous applicant on this device.</span>{" "}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void restartPublicApplyAsSomeoneElse();
        }}
        className="font-semibold text-[color:var(--brand-primary)] underline-offset-2 hover:underline disabled:opacity-60"
      >
        Not you? Apply as someone else
      </button>
    </div>
  );
}

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
  const [sessionErrorMeta, setSessionErrorMeta] = useState<{
    reason?: string;
    signInHref?: string;
    ownerEmail?: string | null;
  } | null>(null);
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
          window.location.pathname.startsWith("/application/candidate") ||
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
          setSessionErrorMeta({
            reason: "reason" in authResult ? authResult.reason : undefined,
            signInHref: "signInHref" in authResult ? authResult.signInHref : undefined,
            ownerEmail: "ownerEmail" in authResult ? authResult.ownerEmail : undefined,
          });
        } else {
          setSessionReady(true);
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
  }, [
    brandingReady,
    brand.slug,
    brand.companyName,
    brand.logoUrl,
    brand.faviconUrl,
  ]);

  if (error) {
    const ownership = sessionErrorMeta?.reason === "application_ownership";
    return (
      <TenantBrandingProvider branding={brand}>
        <div className="mx-auto max-w-lg p-8 text-center text-sm text-red-700">
          <p className="font-medium">
            {ownership ? "Sign in to continue this application" : "Could not start onboarding session"}
          </p>
          <p className="mt-2 text-gray-700">{error}</p>
          {ownership && sessionErrorMeta?.signInHref ? (
            <a
              href={sessionErrorMeta.signInHref}
              className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in{sessionErrorMeta.ownerEmail ? ` as ${sessionErrorMeta.ownerEmail}` : ""}
            </a>
          ) : (
            <p className="mt-4 text-xs text-gray-500">
              In Supabase Dashboard, enable Anonymous Sign-In (Authentication → Providers). Then refresh
              this page.
            </p>
          )}
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
        {sessionReady ? <ApplicantApplyAsSomeoneElseBanner /> : null}
        <Suspense fallback={null}>
          <OnboardingConfigProvider>{children}</OnboardingConfigProvider>
        </Suspense>
      </ApplicantSessionProvider>
    </TenantBrandingProvider>
  );
}
