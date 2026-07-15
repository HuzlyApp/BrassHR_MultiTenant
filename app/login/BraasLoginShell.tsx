"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import BrandingRightPanelLogo, { BrandingHeaderLogo } from "@/app/components/BrandingRightPanelLogo";
import { TenantBrandingProvider } from "@/app/components/tenant/TenantBrandingContext";
import {
  braasLoginShellLogoUrl,
  brandingToCssVars,
  isRemoteOrBlobImageSrc,
  normalizeBrandingImageSrc,
  type TenantBranding,
} from "@/lib/tenant/tenant-branding";

export const interStyle = { fontFamily: "Inter, Arial, sans-serif" };

export const loginInputFocusClass =
  "focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--brand-primary)_20%,transparent)]";

export const loginInputTextClass =
  "text-[15px] font-normal leading-[22px] tracking-normal placeholder:text-[15px] placeholder:leading-[22px] placeholder:font-normal sm:text-[16px] sm:leading-[24px] sm:placeholder:text-[16px] sm:placeholder:leading-[24px]";

export const loginInputClass = `h-[44px] w-full rounded-[8px] border border-[#cbd5e1] px-3 sm:h-[56px] sm:px-[14px] ${loginInputTextClass} text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] ${loginInputFocusClass}`;

export const loginPasswordInputClass = `${loginInputClass} pr-11 sm:pr-12`;

export const loginPrimaryButtonClass =
  "flex h-[46px] w-full items-center justify-center rounded-[10px] text-[15px] font-semibold leading-[20px] tracking-normal text-white transition-[filter] disabled:cursor-not-allowed disabled:bg-[#dddddd] disabled:text-[#c5c5c5] enabled:hover:brightness-95 sm:h-[54px] sm:rounded-[12px] sm:text-[16px] sm:leading-[22px]";

export const loginFieldLabelClass =
  "mb-1.5 block text-[13px] font-normal leading-[18px] tracking-normal text-[#374151] sm:mb-[8px] sm:text-[14px] sm:leading-[20px]";

export const loginPageStackClass = "flex flex-col gap-5 pt-3 sm:gap-[40px] sm:pt-[30px]";
export const loginFormStackClass = "flex flex-col gap-6 sm:gap-[20px]";
export const loginFormOptionsStackClass = "flex flex-col gap-4 sm:gap-5";

export function LoginArtPanel({
  brand,
  className,
}: {
  brand: TenantBranding;
  className?: string;
}) {
  const logoSrc = normalizeBrandingImageSrc(
    braasLoginShellLogoUrl(brand),
    "/images/new-logo-nexus.svg",
    { allowBlob: true }
  );
  const panelSrc = normalizeBrandingImageSrc(brand.loginBackgroundSrc, "/images/handshake.jpg");
  const panelUseNativeImg = isRemoteOrBlobImageSrc(panelSrc);

  return (
    <aside
      className={`login-art relative flex w-full flex-col items-center justify-center self-stretch overflow-visible rounded-[16px] bg-[#111827] p-[14px] sm:rounded-[24px] sm:p-[30px] ${className ?? ""}`}
    >
      <div className="absolute inset-0 overflow-hidden rounded-[16px] sm:rounded-[24px]">
        {panelUseNativeImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panelSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Image src={panelSrc} alt="" fill sizes="510px" priority className="object-cover" />
        )}
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center gap-6 text-center sm:gap-10">
        <BrandingRightPanelLogo
          src={logoSrc}
          alt={brand.companyName}
          widthClassName="w-full max-w-[280px] sm:max-w-[340px]"
        />
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
      <div className="flex items-start pb-2 pt-1 sm:pb-0 sm:pt-0">
        <div className="flex items-center gap-3 sm:gap-[14px]">
          <div className="flex h-[51px] w-[51px] shrink-0 items-center justify-center overflow-visible rounded-[10px] border border-[#e5e7eb] bg-white p-[6px] sm:h-[74px] sm:w-[74px] sm:rounded-[12px] sm:p-[8px]">
            <BrandingHeaderLogo src={logoSrc} alt={brand.companyName} />
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

export function LoginPageShell({
  brand,
  children,
  hideArtOnMobile = false,
}: {
  brand: TenantBranding;
  children: ReactNode;
  hideArtOnMobile?: boolean;
}) {
  const shellStyle = brandingToCssVars(brand) as CSSProperties;

  return (
    <TenantBrandingProvider branding={brand}>
      <main
        className="min-h-screen w-full min-w-0 overflow-x-hidden bg-white max-[640px]:min-h-dvh"
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
              width: 100%;
              max-width: 100%;
              padding: 12px;
              border-radius: 0;
            }

            .login-layout {
              grid-template-columns: minmax(0, 58%) minmax(0, 42%);
              gap: 10px;
            }

            .login-layout.login-layout--single-column {
              grid-template-columns: minmax(0, 1fr);
              gap: 0;
            }

            .login-content {
              width: 100%;
              max-width: 100%;
              min-width: 0;
              padding: 16px 20px;
            }

            .login-art {
              min-height: 620px;
              border-radius: 14px;
            }

            .login-art.login-art--hidden-mobile {
              display: none;
            }
          }

          @media (max-width: 640px) {
            .login-frame {
              width: 100%;
              max-width: 100%;
              min-height: 100dvh;
              padding: 12px 16px 24px;
              border-radius: 0;
            }

            .login-layout,
            .login-layout.login-layout--single-column {
              grid-template-columns: minmax(0, 1fr);
              gap: 0;
              width: 100%;
            }

            .login-content {
              display: flex;
              flex-direction: column;
              justify-content: center;
              width: 100%;
              max-width: 100%;
              min-width: 70%;
              min-height: calc(100dvh - 48px);
              margin: 0 auto;
              padding: 20px 16px 24px;
            }

            .login-art {
              width: 100%;
              max-width: 100%;
              min-height: 200px;
              border-radius: 14px;
              padding: 10px;
            }

            .login-art.login-art--hidden-mobile {
              display: none;
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

        <section className="login-frame mx-auto w-full max-w-full rounded-[30px] bg-white max-[640px]:rounded-none">
          <div
            className={`login-layout w-full max-w-full rounded-[12px] bg-white${hideArtOnMobile ? " login-layout--single-column" : ""}`}
          >
            <div className="login-content flex flex-col">{children}</div>
            <LoginArtPanel
              brand={brand}
              className={hideArtOnMobile ? "login-art--hidden-mobile" : undefined}
            />
          </div>
        </section>
      </main>
    </TenantBrandingProvider>
  );
}
