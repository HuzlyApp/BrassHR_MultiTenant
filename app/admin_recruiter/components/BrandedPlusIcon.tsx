"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type BrandedPlusIconProps = {
  className?: string;
};

/** Plus-circle icon tinted with tenant primary from effective-branding CSS vars. */
export default function BrandedPlusIcon({ className = "h-6 w-6" }: BrandedPlusIconProps) {
  return (
    <BrandedSvgIcon
      src="/icons/admin-recruiter/plus-icon.svg"
      className={className}
      color="var(--brand-primary)"
    />
  );
}
