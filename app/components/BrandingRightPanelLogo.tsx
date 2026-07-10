"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Right-panel logo height on welcome, applicant, and login screens (desktop). */
export const BRANDING_RIGHT_PANEL_LOGO_HEIGHT_REM = 4.488;

/** Mobile welcome / card logo height (+15% over prior mobile size). */
export const BRANDING_MOBILE_LOGO_HEIGHT_REM = 2.9325;

/** Mobile header icon logo sizes (+15%). */
export const BRANDING_MOBILE_HEADER_LOGO_PX = 37;
export const BRANDING_MOBILE_HEADER_LOGO_PX_SM = 55;

/** Space between logo block and divider — matches OnboardingLayout `gap-6`. */
export const BRANDING_RIGHT_PANEL_LOGO_DIVIDER_GAP_REM = 1.5;

export const BRANDING_PANEL_LOGO_WIDTH_CLASS = "w-[18.7rem] max-w-full";

export type BrandingLogoSize = "panel" | "mobile";

/** Square uploads with large dimensions usually include extra padding around the mark. */
export function squareLogoDisplayZoom(naturalWidth: number, naturalHeight: number): number {
  if (!naturalWidth || !naturalHeight) return 1;
  const aspect = naturalWidth / naturalHeight;
  if (aspect < 0.85 || aspect > 1.15) return 1;
  const minSide = Math.min(naturalWidth, naturalHeight);
  if (minSide >= 900) return 1.7;
  if (minSide >= 700) return 1.49;
  if (minSide >= 550) return 1.1;
  return 1;
}

function useLogoZoom(src: string) {
  const [zoom, setZoom] = useState(1);

  const applyZoom = useCallback((img: HTMLImageElement) => {
    const nextZoom = squareLogoDisplayZoom(img.naturalWidth, img.naturalHeight);
    setZoom(nextZoom);
  }, []);

  useEffect(() => {
    setZoom(1);
  }, [src]);

  const imgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) {
        applyZoom(node);
      }
    },
    [applyZoom]
  );

  return { zoom, imgRef, applyZoom };
}

type BrandingRightPanelLogoProps = {
  src: string;
  alt?: string;
  className?: string;
  widthClassName?: string;
  size?: BrandingLogoSize;
};

export default function BrandingRightPanelLogo({
  src,
  alt = "",
  className,
  widthClassName = BRANDING_PANEL_LOGO_WIDTH_CLASS,
  size = "panel",
}: BrandingRightPanelLogoProps) {
  const { zoom, imgRef, applyZoom } = useLogoZoom(src);

  const base = size === "mobile" ? BRANDING_MOBILE_LOGO_HEIGHT_REM : BRANDING_RIGHT_PANEL_LOGO_HEIGHT_REM;
  // Pull padded square logos up so the gap to the divider matches normal logos (Brass HR).
  const dividerPullRem =
    size === "panel" && zoom > 1
      ? Math.max(0, base * (zoom - 1) * 0.25 - BRANDING_RIGHT_PANEL_LOGO_DIVIDER_GAP_REM * 0.15)
      : 0;

  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-visible",
        widthClassName,
        className
      )}
      style={{
        height: `${base}rem`,
        minHeight: `${base}rem`,
        marginBottom: dividerPullRem > 0 ? `-${dividerPullRem}rem` : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-auto max-w-full object-contain"
        style={{
          height: `${base}rem`,
          transform: zoom > 1 ? `scale(${zoom})` : undefined,
          transformOrigin: "center center",
        }}
        onLoad={(event) => {
          applyZoom(event.currentTarget);
        }}
      />
    </div>
  );
}

type BrandingHeaderLogoProps = {
  src: string;
  alt: string;
  className?: string;
};

/** Small logo for mobile login headers (worker / recruiter sign-in). */
export function BrandingHeaderLogo({ src, alt, className }: BrandingHeaderLogoProps) {
  const { zoom, imgRef, applyZoom } = useLogoZoom(src);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={cn(
        "object-contain",
        className ??
          "max-h-[37px] max-w-[37px] sm:max-h-[55px] sm:max-w-[55px]"
      )}
      style={{
        transform: zoom > 1 ? `scale(${zoom})` : undefined,
        transformOrigin: "center center",
      }}
      onLoad={(event) => {
        applyZoom(event.currentTarget);
      }}
    />
  );
}
