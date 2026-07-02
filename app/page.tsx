"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
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
// import { recruiterSignInHref } from "@/lib/auth/recruiter-sign-in";
import { workerSignInHref } from "@/lib/auth/worker-sign-in";
import {
  persistOnboardingSlugCookie,
} from "@/lib/tenant/client-onboarding-slug";
import {
  buildTenantBrandingApiUrl,
  clearOnboardingTenantSlugCookie,
  resolveTenantSlugForClient,
} from "@/lib/tenant/resolve-tenant-context";

export default function Home() {
  const router = useRouter();
  const [brand, setBrand] = useState<TenantBranding>(() =>
    brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG)
  );
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null);
  const [applicationEntryUrl, setApplicationEntryUrl] = useState<string | null>(null);
  const [startingApplication, setStartingApplication] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("error=")) {
      const path = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", path);
    }
  }, []);


  useEffect(() => {
    let alive = true;
    void (async () => {
      const resolved = resolveTenantSlugForClient(window.location.search, {
        path: window.location.pathname,
      });

      if (resolved.isRootDomain && !resolved.slug) {
        clearOnboardingTenantSlugCookie();
      }

      const applicantPortalSlug =
        resolved.slug && isTenantApplicantPortalSlug(resolved.slug)
          ? resolved.slug.trim().toLowerCase()
          : null;

      if (applicantPortalSlug) {
        persistOnboardingSlugCookie(applicantPortalSlug);
        if (alive) setActiveTenantSlug(applicantPortalSlug);
      } else if (alive) {
        setActiveTenantSlug(null);
      }

      const brandingSlug = applicantPortalSlug ?? PLATFORM_DEFAULT_TENANT_SLUG;

      try {
        const brandingUrl = buildTenantBrandingApiUrl(resolved);
        const res = await fetch(brandingUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
      } catch {
        if (alive) setBrand(brandingFallbackForSlug(brandingSlug));
      } finally {
        if (alive) setBrandLoaded(true);
      }
    })();
    const safetyTimer = window.setTimeout(() => {
      if (alive) setBrandLoaded(true);
    }, 15_000);
    return () => {
      alive = false;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (!activeTenantSlug || !isTenantApplicantPortalSlug(activeTenantSlug)) {
      setApplicationEntryUrl(null);
      return;
    }

    let alive = true;
    void (async () => {
      try {
        const res = await fetch(
          `/api/worker-onboarding/entry?tenant=${encodeURIComponent(activeTenantSlug)}`,
          { cache: "no-store" }
        );
        const payload = (await res.json().catch(() => ({}))) as { url?: string };
        if (alive && res.ok && payload.url) {
          setApplicationEntryUrl(payload.url);
        } else if (alive) {
          setApplicationEntryUrl(null);
        }
      } catch {
        if (alive) setApplicationEntryUrl(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeTenantSlug]);

  if (!brandLoaded) {
    return (
      <TenantBrandingProvider branding={brand}>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </TenantBrandingProvider>
    );
  }

  const shell: CSSProperties = {
    ...brandingToCssVars(brand),
    background: `linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))`,
  };

  const resolvedPortalSlug =
    activeTenantSlug && isTenantApplicantPortalSlug(activeTenantSlug)
      ? activeTenantSlug
      : null;

  // const recruiterSignInUrl = recruiterSignInHref({
  //   tenant: resolvedPortalSlug,
  // });

  const workerSignInUrl = workerSignInHref({
    tenant: resolvedPortalSlug,
  });

  const primaryCtaLabel = applicantLandingCtaLabel(resolvedPortalSlug);

  return (
    <TenantBrandingProvider branding={brand}>
      <main style={shell} className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <section className="grid w-full max-w-[1060px] grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] min-[640px]:grid-cols-[58%_42%] min-[900px]:grid-cols-[620px_440px]">
          <div className="flex flex-col items-center justify-center gap-5 px-6 py-7 text-center sm:px-8 sm:py-8 min-[900px]:min-h-[720px] min-[900px]:px-10 min-[900px]:py-10">
            <div className="space-y-3">
              <h1 className="whitespace-nowrap text-[22px] font-semibold leading-[30px] tracking-normal text-slate-800 sm:text-[34px] sm:leading-[44px] min-[900px]:text-[48px] min-[900px]:leading-[60px]">
                {brand.headline}
              </h1>
              <p className="text-[14px] font-normal leading-5 tracking-normal text-slate-500 sm:text-[16px] sm:leading-6">{brand.subtitle}</p>
            </div>

            <button
              type="button"
              disabled={startingApplication}
              onClick={() => {
                if (resolvedPortalSlug) {
                  persistOnboardingSlugCookie(resolvedPortalSlug);
                  void (async () => {
                    if (applicationEntryUrl) {
                      router.push(applicationEntryUrl);
                      return;
                    }
                    setStartingApplication(true);
                    try {
                      const res = await fetch(
                        `/api/worker-onboarding/entry?tenant=${encodeURIComponent(resolvedPortalSlug)}`,
                        { cache: "no-store" }
                      );
                      const payload = (await res.json().catch(() => ({}))) as { url?: string };
                      if (res.ok && payload.url) {
                        router.push(payload.url);
                        return;
                      }
                    } catch {
                      /* fall through */
                    } finally {
                      setStartingApplication(false);
                    }
                    router.push(
                      `/worker-onboarding?tenant=${encodeURIComponent(resolvedPortalSlug)}`
                    );
                  })();
                  return;
                }
                router.push("/signup");
              }}
              style={{ backgroundColor: "var(--brand-primary)", boxShadow: "0 10px 20px color-mix(in srgb, var(--brand-primary) 22%, transparent)" }}
              className="inline-flex min-h-12 min-w-[170px] cursor-pointer items-center justify-center rounded-xl px-6 py-3 text-[20px] font-semibold leading-[22px] text-white transition hover:brightness-105 focus:outline-none disabled:cursor-wait disabled:opacity-80 sm:min-h-14 sm:min-w-[210px] sm:px-8 sm:py-4 sm:text-[22px]"
            >
              {startingApplication ? "Starting…" : primaryCtaLabel}
            </button>

            {resolvedPortalSlug ? (
              <p className="text-center text-[14px] font-normal leading-5 tracking-normal text-slate-500">
                Already approved?{" "}
                <Link
                  href={workerSignInUrl}
                  style={{ color: "var(--brand-primary)" }}
                  className="text-[14px] font-semibold leading-5 underline-offset-4 hover:underline"
                >
                  Worker sign in
                </Link>
              </p>
            ) : null}

            {/* Hidden for Brass HR platform landing — recruiter sign-in link
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
            */}

          </div>

          <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden border-t border-slate-200 min-[640px]:min-h-[620px] min-[640px]:border-l min-[640px]:border-t-0 min-[900px]:min-h-[720px] min-[900px]:w-[440px]">
            <Image
              src={brand.loginBackgroundSrc}
              alt=""
              fill
              sizes="(max-width: 639px) 100vw, (max-width: 899px) 42vw, 440px"
              className="object-cover grayscale"
              priority
            />
            <div className="absolute inset-0 bg-white/75" />

            <div className="relative z-10 flex w-full flex-col items-center justify-center gap-4 px-5 text-center sm:gap-5 sm:px-8 min-[900px]:px-12">
              <div className="relative flex h-[48px] w-[150px] items-center justify-center sm:h-[64px] sm:w-[220px] min-[900px]:h-[80px] min-[900px]:w-[270px]">
                <img src={brand.logoUrl} alt="" className="max-h-[48px] max-w-[150px] object-contain sm:max-h-[64px] sm:max-w-[220px] min-[900px]:max-h-[80px] min-[900px]:max-w-[270px]" />
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

              <p className="max-w-[260px] text-center text-[13px] font-normal leading-5 tracking-normal text-black sm:max-w-[300px] sm:text-[15px] sm:leading-6">
                {brand.tagline}
              </p>
            </div>
          </div>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
