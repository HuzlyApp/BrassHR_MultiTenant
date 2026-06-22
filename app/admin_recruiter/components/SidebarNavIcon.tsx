"use client";

import { useEffect, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import {
  getSidebarIconSrc,
  SIDEBAR_ICON_SIZE_CLASS,
  type SidebarIconType,
} from "@/app/admin_recruiter/components/sidebar-icons";
import {
  ensureTintedSidebarIconMarkup,
  getTintedSidebarIconMarkup,
} from "@/lib/sidebar/sidebar-icon-markup";

type SidebarNavIconProps = {
  iconType: SidebarIconType;
  active: boolean;
};

function SidebarIconPlaceholder() {
  return (
    <span
      className={`${SIDEBAR_ICON_SIZE_CLASS} inline-block shrink-0 rounded-sm bg-[#E2E8F0]`}
      aria-hidden
    />
  );
}

/** Sidebar menu icon — inline SVG tinted with tenant primary (mask-image breaks on these Figma assets). */
export default function SidebarNavIcon({ iconType, active }: SidebarNavIconProps) {
  const branding = useTenantBranding();
  const src = getSidebarIconSrc(iconType, active);
  const primaryHex = branding.primaryHex;
  const [markup, setMarkup] = useState<string | null>(() =>
    getTintedSidebarIconMarkup(src, primaryHex)
  );

  useEffect(() => {
    const cached = getTintedSidebarIconMarkup(src, primaryHex);
    if (cached) {
      setMarkup(cached);
      return;
    }

    let cancelled = false;
    setMarkup(null);

    void ensureTintedSidebarIconMarkup(src, primaryHex).then((next) => {
      if (cancelled) return;
      setMarkup(next);
    });

    return () => {
      cancelled = true;
    };
  }, [src, primaryHex]);

  if (!markup) {
    return <SidebarIconPlaceholder />;
  }

  return (
    <span
      className={`${SIDEBAR_ICON_SIZE_CLASS} inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-full`}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
