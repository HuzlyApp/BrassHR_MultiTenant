"use client";

import { useEffect, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  getSidebarIconSrc,
  SIDEBAR_ICON_SIZE_CLASS,
  type SidebarIconType,
} from "@/app/admin_recruiter/components/sidebar-icons";

const FIGMA_ICON_COLOR = /#BC8B41/gi;
const svgTextCache = new Map<string, string>();

async function loadSvgText(src: string): Promise<string> {
  const cached = svgTextCache.get(src);
  if (cached) return cached;
  const res = await fetch(src);
  if (!res.ok) return "";
  const text = await res.text();
  if (text) svgTextCache.set(src, text);
  return text;
}

type SidebarNavIconProps = {
  iconType: SidebarIconType;
  active: boolean;
};

/** Sidebar menu icon — inline SVG tinted with tenant primary (mask-image breaks on these Figma assets). */
export default function SidebarNavIcon({ iconType, active }: SidebarNavIconProps) {
  const branding = useTenantBranding();
  const src = getSidebarIconSrc(iconType, active);
  const [markup, setMarkup] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    setFailed(false);
    void loadSvgText(src).then((text) => {
      if (cancelled) return;
      if (!text) {
        setFailed(true);
        return;
      }
      setMarkup(text.replace(FIGMA_ICON_COLOR, branding.primaryHex));
    });
    return () => {
      cancelled = true;
    };
  }, [src, branding.primaryHex]);

  if (failed) {
    return (
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className={`${SIDEBAR_ICON_SIZE_CLASS} shrink-0 object-contain`}
        aria-hidden
      />
    );
  }

  if (!markup) {
    return <span className={`${SIDEBAR_ICON_SIZE_CLASS} shrink-0`} aria-hidden />;
  }

  return (
    <span
      className={`${SIDEBAR_ICON_SIZE_CLASS} inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-full`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
