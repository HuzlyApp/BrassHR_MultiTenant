"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type BrandedPhoneIconProps = {
  className?: string;
};

/** Phone icon tinted with tenant primary from effective-branding CSS vars. */
export default function BrandedPhoneIcon({ className = "h-4 w-4" }: BrandedPhoneIconProps) {
  return (
    <BrandedSvgIcon
      src="/icons/admin-recruiter/phone.svg"
      className={className}
      color="var(--brand-primary)"
    />
  );
}
