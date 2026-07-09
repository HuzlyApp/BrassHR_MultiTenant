"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoginBrandHeader, LoginPageShell } from "@/app/login/BraasLoginShell";
import WorkerSignInForm from "@/app/worker-signin/WorkerSignInForm";
import {
  persistOnboardingSlugCookie,
  resolveClientOnboardingTenantSlug,
} from "@/lib/tenant/client-onboarding-slug";
import { getClientTenantHostLabel } from "@/lib/tenant/client-host-subdomain";
import {
  brandingFallbackForSlug,
  isTenantApplicantPortalSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

function WorkerSignInLoadingShell() {
  return <div className="min-h-screen bg-white" />;
}

function WorkerSignInPageContent() {
  const searchParams = useSearchParams();
  const [brand, setBrand] = useState<TenantBranding | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  const tenantSlug = useMemo(() => {
    const fromQuery = searchParams.get("tenant")?.trim().toLowerCase();
    if (fromQuery && isTenantApplicantPortalSlug(fromQuery)) return fromQuery;

    const fromClientQuery = resolveClientOnboardingTenantSlug(
      typeof window !== "undefined" ? window.location.search : ""
    );
    if (fromClientQuery && isTenantApplicantPortalSlug(fromClientQuery)) return fromClientQuery;

    const fromHost = getClientTenantHostLabel();
    if (fromHost && isTenantApplicantPortalSlug(fromHost)) return fromHost;

    return null;
  }, [searchParams]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const hostLabel = getClientTenantHostLabel();
      const qp = searchParams.get("tenant")?.trim().toLowerCase();
      const slugFromQuery =
        qp && isTenantApplicantPortalSlug(qp) ? qp : resolveClientOnboardingTenantSlug(window.location.search);
      const applicantPortalSlug =
        slugFromQuery && isTenantApplicantPortalSlug(slugFromQuery)
          ? slugFromQuery.trim().toLowerCase()
          : hostLabel && isTenantApplicantPortalSlug(hostLabel)
            ? hostLabel
            : null;

      if (applicantPortalSlug) {
        persistOnboardingSlugCookie(applicantPortalSlug);
      }

      const brandingSlug = applicantPortalSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;

      try {
        const brandingUrl = hostLabel
          ? `/api/tenant-branding?subdomain=${encodeURIComponent(hostLabel)}`
          : `/api/tenant-branding?slug=${encodeURIComponent(brandingSlug)}`;
        const res = await fetch(brandingUrl, { cache: "no-store" });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
      } catch {
        if (alive) setBrand(brandingFallbackForSlug(brandingSlug));
      } finally {
        if (alive) setBrandLoaded(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [searchParams]);

  useEffect(() => {
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.backgroundColor = "#ffffff";
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, []);

  if (!brandLoaded || !brand) {
    return <WorkerSignInLoadingShell />;
  }

  return (
    <LoginPageShell brand={brand} hideArtOnMobile>
      <LoginBrandHeader brand={brand} />
      <WorkerSignInForm tenantSlug={tenantSlug} brand={brand} />
    </LoginPageShell>
  );
}

export default function WorkerSignInPage() {
  return (
    <Suspense fallback={<WorkerSignInLoadingShell />}>
      <WorkerSignInPageContent />
    </Suspense>
  );
}
