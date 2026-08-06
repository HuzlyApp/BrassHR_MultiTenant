"use client";

import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

type Props = {
  href: string | null | undefined;
  className?: string;
  iconColor?: string;
  /** Shown when the job has no public page yet (draft / unpublished). */
  disabledTitle?: string;
};

/** Opens the published public job page (same destination as Job Details → View public job page). */
export function JobPublicViewLink({
  href,
  className = "",
  iconColor = "var(--brand-primary)",
  disabledTitle = "Publish this job to view the public page",
}: Props) {
  const baseClass = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white transition ${className}`;

  const icon = (
    <BrandedSvgIcon
      src="/icons/admin-recruiter/eye.svg"
      className="h-4 w-4"
      color={href ? iconColor : "#94A3B8"}
    />
  );

  if (!href) {
    return (
      <span
        className={`${baseClass} cursor-not-allowed opacity-70`}
        title={disabledTitle}
        aria-label={disabledTitle}
      >
        {icon}
      </span>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} cursor-pointer text-[#475569] hover:bg-[#F8FAFC]`}
      aria-label="View public job page"
      title="Public view"
      onClick={(event) => event.stopPropagation()}
    >
      {icon}
    </Link>
  );
}
