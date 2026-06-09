"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type BrandedDeleteIconProps = {
  className?: string;
};

/** Delete/trash icon tinted with tenant primary from effective-branding CSS vars. */
export default function BrandedDeleteIcon({ className = "h-6 w-6" }: BrandedDeleteIconProps) {
  return (
    <BrandedSvgIcon
      src="/icons/delete-icon.svg"
      className={className}
      color="var(--brand-primary)"
    />
  );
}
