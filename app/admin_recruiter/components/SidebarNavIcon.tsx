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

/** Sidebar menu icon — inline SVG tinted with tenant active/inactive colors. */
export default function SidebarNavIcon({ iconType, active }: SidebarNavIconProps) {
  const branding = useTenantBranding();
  const src = getSidebarIconSrc(iconType, active);
  const tintHex = active ? branding.primaryHex : branding.secondaryHex;
  const [markup, setMarkup] = useState<string | null>(() =>
    getTintedSidebarIconMarkup(src, tintHex)
  );

  useEffect(() => {
    const cached = getTintedSidebarIconMarkup(src, tintHex);
    if (cached) {
      setMarkup(cached);
      return;
    }

    let cancelled = false;
    setMarkup(null);

    void ensureTintedSidebarIconMarkup(src, tintHex).then((next) => {
      if (cancelled) return;
      setMarkup(next);
    });

    return () => {
      cancelled = true;
    };
  }, [src, tintHex]);

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
