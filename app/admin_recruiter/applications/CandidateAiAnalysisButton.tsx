"use client";

import Link from "next/link";
import BrandedSvgIcon from "@/app/components/BrandedSvgIcon";

export function applicationAiAnalysisHref(applicationId: string, jobId?: string) {
  const path = `/admin_recruiter/applications/ai-analysis/${encodeURIComponent(applicationId)}`;
  if (!jobId) return path;
  return `${path}?jobId=${encodeURIComponent(jobId)}`;
}

type CandidateAiAnalysisButtonProps = {
  applicationId: string;
  jobId?: string;
  candidateName?: string;
};

/**
 * Figma Actions AI control: 14×14 branded icon, 8px horizontal / 6px vertical
 * padding, 2px square border, 8px corner radius, tenant primary color.
 */
export function CandidateAiAnalysisButton({
  applicationId,
  jobId,
  candidateName,
}: CandidateAiAnalysisButtonProps) {
  const label = candidateName?.trim()
    ? `Open AI analysis for ${candidateName.trim()}`
    : "Open AI analysis";

  return (
    <Link
      href={applicationAiAnalysisHref(applicationId, jobId)}
      aria-label={label}
      title="AI Analysis"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex items-center justify-center rounded-lg border-2 border-[color:var(--brand-primary)] px-2 py-1.5 transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)]"
    >
      <BrandedSvgIcon
        src="/ai-icon.svg"
        className="h-[14px] w-[14px]"
        color="var(--brand-primary)"
      />
    </Link>
  );
}
