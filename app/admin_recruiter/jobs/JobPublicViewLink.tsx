"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { JOB_FORM_OUTLINE_BUTTON_CLASS } from "./job-form-shared";

type Props = {
  href: string | null | undefined;
  className?: string;
  style?: CSSProperties;
  iconColor?: string;
  /** Override icon path (defaults: list eye / job-details view-public). */
  iconSrc?: string;
  /** Shown when the job has no public page yet (draft / unpublished). */
  disabledTitle?: string;
  /** Icon-only (lists) or full outline button with label (job details). */
  variant?: "icon" | "button";
  label?: string;
};

/** Opens the published public job page (same destination as Job Details → View public job page). */
export function JobPublicViewLink({
  href,
  className = "",
  style,
  iconColor = "var(--brand-primary)",
  iconSrc,
  disabledTitle = "Publish this job to view the public page",
  variant = "icon",
  label = "View public job page",
}: Props) {
  const resolvedIconSrc =
    iconSrc ??
    (variant === "button"
      ? "/icons/job-details-icons/view-public-job.svg"
      : "/icons/admin-recruiter/eye.svg");
  const icon = (
    <BrandedSvgIcon
      src={resolvedIconSrc}
      className="h-4 w-4 shrink-0"
      color={href ? iconColor : "#94A3B8"}
    />
  );

  if (variant === "button") {
    const buttonClass = `${JOB_FORM_OUTLINE_BUTTON_CLASS} ${className}`.trim();

    if (!href) {
      return (
        <button
          type="button"
          disabled
          title={disabledTitle}
          aria-label={disabledTitle}
          className={`${buttonClass} opacity-50`}
          style={style}
        >
          {icon}
          {label}
        </button>
      );
    }

    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        style={style}
        aria-label={label}
        title="Public view"
      >
        {icon}
        {label}
      </Link>
    );
  }

  const baseClass = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white transition ${className}`;

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
