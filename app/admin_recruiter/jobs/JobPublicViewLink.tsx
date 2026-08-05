"use client";

import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type Props = {
  href: string | null | undefined;
  className?: string;
  iconColor?: string;
};

/** Opens the published public job page (same destination as Job Details → View public job page). */
export function JobPublicViewLink({
  href,
  className = "",
  iconColor = "var(--brand-primary)",
}: Props) {
  if (!href) return null;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#475569] transition hover:bg-[#F8FAFC] ${className}`}
      aria-label="View public job page"
      title="Public view"
      onClick={(event) => event.stopPropagation()}
    >
      <BrandedSvgIcon
        src="/icons/admin-recruiter/eye.svg"
        className="h-4 w-4"
        color={iconColor}
      />
    </Link>
  );
}
