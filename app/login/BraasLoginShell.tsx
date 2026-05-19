"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import type { TenantBranding } from "@/lib/tenant/tenant-branding";

export const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export function LoginArtPanel({ brand }: { brand: TenantBranding }) {
  return (
    <aside className="login-art relative flex w-full flex-col items-center justify-center gap-[40px] self-stretch overflow-hidden rounded-[24px] bg-[#111827] p-[30px]">
      <Image src={brand.loginBackgroundSrc} alt="" fill sizes="510px" priority className="object-cover" />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-[40px] text-center">
        <div className="relative flex h-[80px] w-[200px] items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoUrl} alt={brand.companyName} className="max-h-[80px] max-w-[200px] object-contain" />
        </div>
        <p
          className="max-w-[352px] text-center text-[24px] font-normal leading-[1.2] text-white"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          {brand.tagline}
        </p>
      </div>
    </aside>
  );
}

export function LoginBrandHeader({ brand }: { brand: TenantBranding }) {
  return (
    <>
      <div className="flex h-[115px] items-start">
        <div className="flex items-center gap-[14px]">
          <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-white p-[8px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt={brand.companyName} className="max-h-[48px] max-w-[48px] object-contain" />
          </div>
          <div>
            <p className="text-[18px] font-semibold uppercase leading-[28px] text-black" style={interStyle}>
              {brand.companyName}
            </p>
            <p className="text-[16px] font-normal leading-[24px] text-[#6b7280]" style={interStyle}>
              {brand.subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="py-[8px]">
        <div className="h-px w-full bg-[#e7edf4]" />
      </div>
    </>
  );
}

export function LoginPageShell({ brand, children }: { brand: TenantBranding; children: ReactNode }) {
  return (
    <TenantBrandingProvider branding={brand}>
      <main className="min-h-screen w-full overflow-x-hidden bg-white" style={{ backgroundColor: "#ffffff" }}>
        <style>{`
          .login-frame {
            box-sizing: border-box;
            padding: clamp(32px, 5.55vw, 80px);
          }

          .login-layout {
            display: grid;
            grid-template-columns: minmax(520px, 770px) minmax(340px, 510px);
            gap: 0;
            justify-content: center;
            align-items: stretch;
          }

          .login-content {
            width: 100%;
            max-width: 770px;
            min-height: 980px;
            padding: 20px 80px 20px 20px;
          }

          .login-art {
            width: 100%;
            max-width: 510px;
            min-height: 980px;
          }

          @media (min-width: 1440px) {
            .login-frame {
              width: 1440px;
              max-width: 1440px;
              min-height: 1140px;
              padding: 80px;
            }

            .login-layout {
              width: 1280px;
              grid-template-columns: 770px 510px;
            }

            .login-content {
              width: 770px;
              min-height: 980px;
            }

            .login-art {
              width: 510px;
              min-height: 980px;
            }
          }
        `}</style>

        <section className="login-frame mx-auto w-full rounded-[30px] bg-white">
          <div className="login-layout w-full rounded-[12px] bg-white">
            <div className="login-content flex flex-col">{children}</div>
            <LoginArtPanel brand={brand} />
          </div>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
