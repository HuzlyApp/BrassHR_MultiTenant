"use client";

import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { candidateApplicantProfileHref } from "./candidate-links";

type CandidateProfileIconLinkProps = {
  workerId: string | null | undefined;
  candidateName?: string;
  jobId?: string | null;
  from?: string;
  className?: string;
};

export function CandidateProfileIconLink({
  workerId,
  candidateName,
  jobId,
  from = "candidates",
  className = "inline-flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]",
}: CandidateProfileIconLinkProps) {
  const id = typeof workerId === "string" ? workerId.trim() : "";
  if (!id) return null;

  const label = candidateName?.trim()
    ? `View ${candidateName.trim()} profile`
    : "View candidate profile";

  return (
    <Link
      href={candidateApplicantProfileHref(id, {
        from,
        jobId: jobId || undefined,
        tab: "applications",
      })}
      className={className}
      aria-label={label}
      title="View profile"
      onClick={(event) => event.stopPropagation()}
    >
      <BrandedSvgIcon
        src="/icons/admin-recruiter/profile.svg"
        className="h-4 w-4"
        color="var(--brand-primary)"
      />
    </Link>
  );
}
