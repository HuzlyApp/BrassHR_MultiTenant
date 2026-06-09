"use client";

import { useEffect, useMemo, useState } from "react";
import { useTenantBranding } from "@/app/components/tenant/TenantBrandingContext";
import { normalizeBrandingImageSrc } from "@/lib/tenant/tenant-branding";

type BrandedHistoryIconProps = {
  className?: string;
};

/**
 * History row badge — tenant logo from effective-branding API in a round frame.
 * Used on all candidate detail history / activity lists.
 */
export default function BrandedHistoryIcon({ className = "h-6 w-6" }: BrandedHistoryIconProps) {
  const branding = useTenantBranding();
  const [imageFailed, setImageFailed] = useState(false);

  const logoSrc = useMemo(
    () => normalizeBrandingImageSrc(branding.logoUrl, "", { allowBlob: true }),
    [branding.logoUrl]
  );

  const companyInitial = useMemo(() => {
    const name = branding.companyName?.trim();
    return name ? name[0]!.toUpperCase() : "?";
  }, [branding.companyName]);

  useEffect(() => {
    setImageFailed(false);
  }, [logoSrc]);

  if (!logoSrc || imageFailed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--brand-primary)] text-[10px] font-semibold text-white ${className}`}
        aria-hidden
      >
        {companyInitial}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[color:color-mix(in_srgb,var(--brand-primary)_22%,white)] bg-white ${className}`}
      aria-hidden
    >
      <img
        src={logoSrc}
        alt=""
        className="h-[72%] w-[72%] object-contain"
        onError={() => setImageFailed(true)}
      />
    </span>
  );
}
