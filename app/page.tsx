"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { brandingToCssVars, defaultTenantBranding, type TenantBranding } from "@/lib/tenant/tenant-branding";
import { persistOnboardingSlugCookie } from "@/lib/tenant/client-onboarding-slug";

export default function Home() {
  const router = useRouter();
  const [brand, setBrand] = useState<TenantBranding>(() => defaultTenantBranding());

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/public/tenant", { cache: "no-store" });
        const payload = (await res.json()) as { branding?: TenantBranding };
        if (alive && payload.branding) setBrand(payload.branding);
      } catch {
        /* default */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const shell: CSSProperties = {
    ...brandingToCssVars(brand),
    background: `linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))`,
  };

  return (
    <TenantBrandingProvider branding={brand}>
      <main style={shell} className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <section className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:h-[600px] md:w-[1060px] md:grid md:grid-cols-[620px_440px]">
          <div className="flex min-h-[550px] flex-col items-center justify-center gap-9 px-8 py-10 text-center sm:px-10 md:h-[600px] md:px-10 md:py-10">
            <div className="space-y-3">
              <h1 className="text-[34px] font-semibold leading-[48px] tracking-normal text-slate-800 sm:text-[42px] md:text-[48px]">
                {brand.headline}
              </h1>
              <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-500">{brand.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                const slug = brand.slug?.trim();
                if (slug) persistOnboardingSlugCookie(slug);
                const q = slug ? `?tenant=${encodeURIComponent(slug)}` : "";
                router.push(`/application/step-1-upload${q}`);
              }}
              style={{ backgroundColor: "var(--brand-primary)", boxShadow: "0 10px 20px color-mix(in srgb, var(--brand-primary) 22%, transparent)" }}
              className="inline-flex min-h-14 min-w-[210px] cursor-pointer items-center justify-center rounded-xl px-8 py-4 text-[22px] font-semibold leading-[22px] text-white transition hover:brightness-105 focus:outline-none"
            >
              Start application
            </button>

            <p className="text-center text-[14px] font-normal leading-5 tracking-normal text-slate-500">
              Need to sign in as a recruiter?{" "}
              <Link
                href={brand.slug ? `/login?tenant=${encodeURIComponent(brand.slug)}` : "/login"}
                style={{ color: "var(--brand-primary)" }}
                className="text-[14px] font-semibold leading-5 underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Operate your own staffing brand?</p>
              <p className="mt-1 text-[13px] text-slate-600">
                Set up logos, palette, recruiter admin, and saved tenant slug.
              </p>
              <Link
                href="/tenant-onboarding"
                className="mt-4 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--brand-secondary)" }}
              >
                Create your organization
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden border-t border-slate-200 md:h-[600px] md:w-[440px] md:border-l md:border-t-0">
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
                  <Image src="/images/tabler_circle-asterisk.svg" alt="" width={20} height={20} className="flex-none" />
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
