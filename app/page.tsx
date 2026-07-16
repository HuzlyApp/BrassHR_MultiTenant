"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  applicantLandingCtaLabel,
  brandingToCssVars,
  brandingFallbackForSlug,
  isRemoteOrBlobImageSrc,
  isTenantApplicantPortalSlug,
  normalizeBrandingImageSrc,
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
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import BrandingRightPanelLogo, {
  BRANDING_RIGHT_PANEL_STACK_GAP_CLASS,
} from "@/app/components/BrandingRightPanelLogo";

function BrandingFillImage({
  src,
  alt = "",
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (isRemoteOrBlobImageSrc(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`absolute inset-0 h-full w-full ${className ?? ""}`.trim()} />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}

export default function Home() {
  const router = useRouter();
  const [brand, setBrand] = useState<TenantBranding>(() =>
    brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG)
  );
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [activeTenantSlug, setActiveTenantSlug] = useState<string | null>(null);
  const [tenantNotFound, setTenantNotFound] = useState(false);
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
        const payload = (await res.json()) as { branding?: TenantBranding; tenantFound?: boolean };
        if (alive && payload.tenantFound === false) {
          setActiveTenantSlug(null);
          setBrand(brandingFallbackForSlug(PLATFORM_DEFAULT_TENANT_SLUG));
          setTenantNotFound(true);
        } else if (alive && payload.branding) {
          setBrand(payload.branding);
          setTenantNotFound(false);
        }
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
    background: "var(--brand-primary)",
  };

  const resolvedPortalSlug =
    activeTenantSlug && isTenantApplicantPortalSlug(activeTenantSlug)
      ? activeTenantSlug
      : null;
  const isPlatformWelcome = !resolvedPortalSlug;

  // const recruiterSignInUrl = recruiterSignInHref({
  //   tenant: resolvedPortalSlug,
  // });

  const workerSignInUrl = workerSignInHref({
    tenant: resolvedPortalSlug,
  });

  const primaryCtaLabel = applicantLandingCtaLabel(resolvedPortalSlug);
  const backgroundSrc = normalizeBrandingImageSrc(brand.loginBackgroundSrc, "/images/handshake.jpg");
  const logoSrc = normalizeBrandingImageSrc(
    brand.loginLogoUrl || brand.logoUrl,
    "/images/new-logo-nexus.svg",
    { allowBlob: true }
  );

  if (tenantNotFound) {
    return (
      <TenantBrandingProvider branding={brand}>
        <main
          style={shell}
          className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6"
        >
          <section className="w-full max-w-[520px] rounded-2xl bg-white px-6 py-10 text-center shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:px-10 sm:py-12">
            <h1 className="text-[28px] font-semibold leading-9 text-slate-900 sm:text-[34px] sm:leading-10">
              Tenant not found
            </h1>
            <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-6 text-slate-500 sm:text-[16px]">
              This tenant link is invalid or the tenant is no longer available.
            </p>
            <Link
              href="/"
              onClick={(event) => {
                event.preventDefault();
                window.location.assign("/");
              }}
              className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-[16px] font-semibold text-white transition hover:brightness-105"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              Go to Brass HR
            </Link>
          </section>
        </main>
      </TenantBrandingProvider>
    );
  }

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        style={shell}
        className="relative flex h-[100dvh] w-full items-center justify-center overflow-hidden p-3 sm:p-4 lg:p-6"
      >
        <div className="absolute inset-0 min-[1024px]:hidden" aria-hidden>
          <BrandingFillImage
            src={backgroundSrc}
            sizes="(max-width: 1023px) 100vw, 0px"
            className="object-cover"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(165deg, color-mix(in srgb, var(--brand-primary) 74%, white), color-mix(in srgb, var(--brand-primary) 88%, black 12%))",
            }}
          />
        </div>

        <section className="relative z-10 flex h-full w-full items-center justify-center min-[1024px]:hidden">
          <div className="relative z-10 w-[92vw] max-w-[516px] min-h-[420px] rounded-[22px] bg-white/88 px-7 py-10 text-center shadow-[0_20px_46px_rgba(0,0,0,0.22)] backdrop-blur-[1px] max-[649px]:min-h-[357px] sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden>
              <div className="absolute inset-0 bg-white/32" />
              <BrandingFillImage
                src={backgroundSrc}
                sizes="(max-width: 1023px) 90vw, 0px"
                className="object-cover object-right opacity-28 grayscale"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-white/72 via-white/58 to-black/10" />
            </div>
            <div
              className={`relative z-10 flex w-full flex-col items-center pt-6${
                isPlatformWelcome ? " h-full translate-y-3 justify-center pt-0" : ""
              }`}
            >
            <BrandingRightPanelLogo
              src={logoSrc}
              alt={`${brand.companyName} logo`}
              size="mobile"
              widthClassName="w-full max-w-[220px]"
              className="origin-center scale-[1.15]"
            />
            <div className="mt-6 flex w-full flex-col items-center gap-5">
            <div className="space-y-3">
              <h1 className="whitespace-nowrap text-[38px] font-semibold leading-[44px] tracking-normal text-slate-800 max-[399px]:text-[22px] max-[399px]:leading-[28px] min-[400px]:max-[549px]:text-[32px] min-[400px]:max-[549px]:leading-[37px] min-[550px]:max-[1023px]:text-[34px] min-[550px]:max-[1023px]:leading-[40px]">
                {brand.headline}
              </h1>
              <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-500">{brand.subtitle}</p>
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
              className="inline-flex min-h-14 w-full max-w-[280px] cursor-pointer items-center justify-center rounded-xl px-8 py-4 text-[22px] font-semibold leading-[22px] text-white transition hover:brightness-105 focus:outline-none disabled:cursor-wait disabled:opacity-80 max-[499px]:min-h-12 max-[499px]:py-3"
            >
              {startingApplication ? "Starting…" : primaryCtaLabel}
            </button>

            {resolvedPortalSlug ? (
              <p className="text-center text-[15px] font-normal leading-6 tracking-normal text-slate-500">
                Already approved?{" "}
                <Link
                  href={workerSignInUrl}
                  style={{ color: "var(--brand-primary)" }}
                  className="text-[15px] font-semibold leading-6 underline-offset-4 hover:underline"
                >
                  Worker sign in
                </Link>
              </p>
            ) : null}
            </div>
            </div>
          </div>
        </section>

        {/* Desktop/tablet split layout */}
        <section className="relative z-10 hidden h-[calc(100dvh-3rem)] max-h-[760px] w-full max-w-[1160px] grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] min-[1024px]:grid min-[1024px]:grid-cols-[minmax(0,17fr)_minmax(300px,12fr)]">
          <div className="flex flex-col items-center justify-center gap-5 px-10 py-10 text-center">
            <div className="space-y-3">
              <h1 className="whitespace-nowrap text-[42px] font-semibold leading-[50px] tracking-normal text-slate-800 max-[1079px]:text-[38px] max-[1079px]:leading-[45px] min-[1200px]:text-[48px] min-[1200px]:leading-[60px]">
                {brand.headline}
              </h1>
              <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-500">{brand.subtitle}</p>
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
              className="inline-flex min-h-14 min-w-[210px] cursor-pointer items-center justify-center rounded-xl px-8 py-4 text-[22px] font-semibold leading-[22px] text-white transition hover:brightness-105 focus:outline-none disabled:cursor-wait disabled:opacity-80"
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

          <div className="relative flex w-[480px] items-center justify-center overflow-hidden border-l border-slate-200">
            <BrandingFillImage
              src={backgroundSrc}
              sizes="480px"
              className="object-cover object-center grayscale"
              priority
            />
            <div className="absolute inset-0 bg-white/45" />
            <div
              className={`relative z-10 flex h-full w-full max-w-[340px] flex-col items-center justify-center ${BRANDING_RIGHT_PANEL_STACK_GAP_CLASS} px-6 pt-[12%] text-center`}
            >
              <BrandingRightPanelLogo src={logoSrc} alt={`${brand.companyName} logo`} />
              <div className="flex w-full items-center justify-center gap-3">
                <span className="h-px flex-1 bg-slate-400/40" />
                <span className="inline-flex h-7 w-7 items-center justify-center">
                  <BrandedSvgIcon
                    src="/icons/circle-star-icon.svg"
                    className="h-5 w-5 flex-none"
                    color={brand.primaryHex}
                  />
                </span>
                <span className="h-px flex-1 bg-slate-400/40" />
              </div>
              <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-700">
                {brand.subtitle}
              </p>
            </div>
          </div>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
