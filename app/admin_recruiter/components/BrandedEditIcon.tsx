"use client";

import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type BrandedEditIconProps = {
  className?: string;
};

/** Pencil icon tinted with tenant primary from effective-branding CSS vars. */
export default function BrandedEditIcon({ className = "h-4 w-4" }: BrandedEditIconProps) {
  return (
    <BrandedSvgIcon
      src="/icons/template-icons/pencil.svg"
      className={className}
      color="var(--brand-primary)"
    />
  );
}
