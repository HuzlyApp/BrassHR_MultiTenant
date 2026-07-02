"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import { braasLoginShellLogoUrl, brandingToCssVars, type TenantBranding } from "@/lib/tenant/tenant-branding";

export const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export function LoginArtPanel({ brand }: { brand: TenantBranding }) {
  const logoSrc = braasLoginShellLogoUrl(brand);

  return (
    <aside className="login-art relative flex w-full flex-col items-center justify-center gap-[24px] self-stretch overflow-hidden rounded-[16px] bg-[#111827] p-[14px] sm:gap-[40px] sm:rounded-[24px] sm:p-[30px]">
      <Image src={brand.loginBackgroundSrc} alt="" fill sizes="510px" priority className="object-cover" />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-[20px] text-center sm:gap-[40px]">
        <div className="relative flex h-[56px] w-[136px] items-center justify-center sm:h-[80px] sm:w-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt={brand.companyName}
            className="max-h-[56px] max-w-[136px] object-contain sm:max-h-[80px] sm:max-w-[200px]"
          />
        </div>
        <p
          className="max-w-[260px] text-center text-[16px] font-normal leading-[1.35] text-white sm:max-w-[352px] sm:text-[24px] sm:leading-[1.2]"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        >
          {brand.tagline}
        </p>
      </div>
    </aside>
  );
}

export function LoginBrandHeader({ brand }: { brand: TenantBranding }) {
  const logoSrc = braasLoginShellLogoUrl(brand);

  return (
    <>
      <div className="flex items-start pb-2 sm:pb-0">
        <div className="flex items-center gap-3 sm:gap-[14px]">
          <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#e5e7eb] bg-white p-[6px] sm:h-[64px] sm:w-[64px] sm:rounded-[12px] sm:p-[8px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt={brand.companyName}
              className="max-h-[32px] max-w-[32px] object-contain sm:max-h-[48px] sm:max-w-[48px]"
            />
          </div>
          <div>
            <p className="text-[15px] font-semibold uppercase leading-[20px] text-black sm:text-[18px] sm:leading-[28px]" style={interStyle}>
              {brand.companyName}
            </p>
            <p className="text-[13px] font-normal leading-[18px] sm:text-[16px] sm:leading-[24px]" style={{ ...interStyle, color: "var(--brand-muted)" }}>
              {brand.subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="py-[6px] sm:py-[8px]">
        <div className="h-px w-full bg-[#e7edf4]" />
      </div>
    </>
  );
}

export function LoginPageShell({ brand, children }: { brand: TenantBranding; children: ReactNode }) {
  const shellStyle = brandingToCssVars(brand) as CSSProperties;

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        className="min-h-screen w-full overflow-x-hidden bg-white"
        style={{ ...shellStyle, backgroundColor: "#ffffff" }}
      >
        <style>{`
          .login-frame {
            box-sizing: border-box;
            padding: clamp(32px, 5.55vw, 80px);
          }

          .login-layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 510px;
            gap: clamp(20px, 2.4vw, 40px);
            justify-content: center;
            align-items: start;
          }

          .login-content {
            width: 100%;
            max-width: 100%;
            min-height: auto;
            padding: 20px 24px 20px 20px;
          }

          .login-art {
            width: 510px;
            max-width: 510px;
            min-height: 980px;
          }

          @media (max-width: 1280px) {
            .login-frame {
              padding: 24px;
            }

            .login-layout {
              grid-template-columns: minmax(0, 56%) minmax(0, 44%);
              gap: 16px;
            }

            .login-content {
              padding: 14px;
            }

            .login-art {
              width: 100%;
              max-width: 100%;
              min-height: 780px;
            }
          }

          @media (max-width: 768px) {
            .login-frame {
              padding: 8px;
            }

            .login-layout {
              grid-template-columns: minmax(0, 58%) minmax(0, 42%);
              gap: 10px;
            }

            .login-content {
              padding: 8px;
            }

            .login-art {
              min-height: 620px;
              border-radius: 14px;
            }
          }

          @media (max-width: 600px) {
            .login-frame {
              padding: 6px;
            }

            .login-layout {
              grid-template-columns: 1fr;
              gap: 8px;
            }

            .login-content {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              padding: 8px 10px;
            }

            .login-art {
              width: 100%;
              max-width: 100%;
              min-height: 200px;
              border-radius: 14px;
              padding: 10px;
            }
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
              gap: 40px;
            }

            .login-content {
              width: 770px;
              min-height: auto;
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
