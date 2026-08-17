"use client";

import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";
import { candidateAiAnalysisHref } from "@/app/admin_recruiter/candidates/candidate-links";

type CandidateAiAnalysisLinkProps = {
  workerId: string | null | undefined;
  candidateName?: string;
  className?: string;
};

export function CandidateAiAnalysisLink({
  workerId,
  candidateName,
  className = "inline-flex h-[26px] w-[30px] items-center justify-center rounded-lg border-2 border-[color:var(--brand-primary)] transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]",
}: CandidateAiAnalysisLinkProps) {
  const id = typeof workerId === "string" ? workerId.trim() : "";
  if (!id) return null;

  const label = candidateName?.trim()
    ? `Open AI analysis for ${candidateName.trim()}`
    : "Open AI analysis";

  return (
    <Link
      href={candidateAiAnalysisHref(id)}
      className={className}
      aria-label={label}
      title="AI Analysis"
      onClick={(event) => event.stopPropagation()}
    >
      <span className="relative size-[14px] overflow-hidden" aria-hidden>
        <BrandedSvgIcon src="/ai-icon.svg" className="absolute inset-0 h-[14px] w-[14px]" color="var(--brand-primary)" />
      </span>
    </Link>
  );
}
