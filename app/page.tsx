"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import ApplicantSignInCard from "@/app/components/ApplicantSignInCard";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  applicantLandingCtaLabel,
  brandingToCssVars,
  brandingFallbackForSlug,
  isTenantApplicantPortalSlug,
  PLATFORM_DEFAULT_TENANT_SLUG,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";
import { recruiterSignInHref } from "@/lib/auth/recruiter-sign-in";
import {
  persistOnboardingSlugCookie,
  resolveClientOnboardingTenantSlug,
} from "@/lib/tenant/client-onboarding-slug";
import { getClientTenantHostLabel } from "@/lib/tenant/client-host-subdomain";

export default function Home() {
  const router = useRouter();
  const [brand, setBrand] = useState<TenantBranding>(() => {
    if (typeof window === "undefined") {
      return brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG);
    }
    const slug = resolveClientOnboardingTenantSlug(window.location.search);
    return isTenantApplicantPortalSlug(slug)
      ? brandingFallbackForSlug(slug)
      : brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG);
  });
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return resolveClientOnboardingTenantSlug(window.location.search);
  });

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("error=")) {
      const path = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", path);
    }
  }, []);


  useEffect(() => {
    let alive = true;
    void (async () => {
      const hostLabel = getClientTenantHostLabel();
      const slugFromQuery = resolveClientOnboardingTenantSlug(window.location.search);
      const rawSlug = slugFromQuery ?? hostLabel ?? null;
      const applicantPortalSlug = isTenantApplicantPortalSlug(rawSlug)
        ? rawSlug!.trim().toLowerCase()
        : null;
      const brandingSlug = applicantPortalSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;

      if (applicantPortalSlug) {
        persistOnboardingSlugCookie(applicantPortalSlug);
        if (alive) setActiveTenantSlug(applicantPortalSlug);
      } else if (alive) {
        setActiveTenantSlug(null);
      }

      if (hostLabel && !slugFromQuery && isTenantApplicantPortalSlug(hostLabel)) {
        persistOnboardingSlugCookie(hostLabel);
      }

      try {
        const brandingUrl = hostLabel
          ? `/api/tenant-branding?subdomain=${encodeURIComponent(hostLabel)}`
          : `/api/tenant-branding?slug=${encodeURIComponent(brandingSlug)}`;
        const res = await fetch(brandingUrl, {
          cache: "no-store",
        });
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
  }, []);

  if (!brandLoaded) {
    return (
      <TenantBrandingProvider branding={brand}>
        <div className="min-h-screen bg-white" />
      </TenantBrandingProvider>
    );
  }

  const shell: CSSProperties = {
    ...brandingToCssVars(brand),
    background: `linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))`,
  };

  const resolvedPortalSlug =
    (activeTenantSlug && isTenantApplicantPortalSlug(activeTenantSlug)
      ? activeTenantSlug
      : null) ||
    (() => {
      const fromQuery = resolveClientOnboardingTenantSlug(
        typeof window !== "undefined" ? window.location.search : ""
      );
      return isTenantApplicantPortalSlug(fromQuery) ? fromQuery : null;
    })() ||
    (() => {
      const fromHost = getClientTenantHostLabel();
      return isTenantApplicantPortalSlug(fromHost) ? fromHost : null;
    })();

  const recruiterSignInUrl = recruiterSignInHref({
    tenant: resolvedPortalSlug,
  });

  const primaryCtaLabel = applicantLandingCtaLabel(resolvedPortalSlug);

  return (
    <TenantBrandingProvider branding={brand}>
      <main style={shell} className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <section className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:min-h-[720px] md:w-[1060px] md:grid md:grid-cols-[620px_440px]">
          <div className="flex min-h-[650px] flex-col items-center justify-center gap-7 px-8 py-10 text-center sm:px-10 md:min-h-[720px] md:px-10 md:py-10">
            <div className="space-y-3">
              <h1 className="text-[34px] font-semibold leading-[48px] tracking-normal text-slate-800 sm:text-[42px] md:text-[48px]">
                {brand.headline}
              </h1>
              <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-500">{brand.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (resolvedPortalSlug) {
                  persistOnboardingSlugCookie(resolvedPortalSlug);
                  router.push(
                    `/worker-onboarding?tenant=${encodeURIComponent(resolvedPortalSlug)}`
                  );
                  return;
                }
                router.push("/signup");
              }}
              style={{ backgroundColor: "var(--brand-primary)", boxShadow: "0 10px 20px color-mix(in srgb, var(--brand-primary) 22%, transparent)" }}
              className="inline-flex min-h-14 min-w-[210px] cursor-pointer items-center justify-center rounded-xl px-8 py-4 text-[22px] font-semibold leading-[22px] text-white transition hover:brightness-105 focus:outline-none"
            >
              {primaryCtaLabel}
            </button>

            {resolvedPortalSlug ? <ApplicantSignInCard tenantSlug={resolvedPortalSlug} /> : null}

            <p className="text-center text-[14px] font-normal leading-5 tracking-normal text-slate-500">
              Need to sign in as a recruiter?{" "}
              <Link
                href={recruiterSignInUrl}
                style={{ color: "var(--brand-primary)" }}
                className="text-[14px] font-semibold leading-5 underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>

          </div>

          <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden border-t border-slate-200 md:min-h-[720px] md:w-[440px] md:border-l md:border-t-0">
            <Image
              src={brand.loginBackgroundSrc}
              alt=""
              fill
              sizes="(max-width: 767px) 100vw, 440px"
              className="object-cover grayscale"
              priority
            />
            <div className="absolute inset-0 bg-white/75" />

            <div className="relative z-10 flex w-full flex-col items-center justify-center gap-5 px-8 text-center md:px-12">
              <div className="relative flex h-[80px] w-[270px] items-center justify-center">
                <img src={brand.logoUrl} alt="" className="max-h-[80px] max-w-[270px] object-contain" />
              </div>

              <div className="flex w-full max-w-[340px] items-center justify-center gap-4">
                <div className="h-px flex-1 bg-slate-400/40" />
                <div className="flex h-7 w-7 items-center justify-center">
                  <BrandedSvgIcon
                    src="/icons/circle-star-icon.svg"
                    className="h-5 w-5 flex-none"
                    color={brand.primaryHex}
                  />
                </div>
                <div className="h-px flex-1 bg-slate-400/40" />
              </div>

              <p className="max-w-[300px] text-center text-[15px] font-normal leading-6 tracking-normal text-black">
                {brand.tagline}
              </p>
            </div>
          </div>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
