"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { candidateFinalApprovalHref } from "@/app/admin_recruiter/candidates/candidate-links";

type CandidateAiFinalApprovalLinkProps = {
  workerId: string | null | undefined;
  /** Pipeline / application status used to decide visibility. */
  status?: string | null;
  candidateName?: string;
  className?: string;
  iconClassName?: string;
};

/**
 * Statuses where AI Final Approval is available:
 * For Approval, Approved, and after the candidate becomes a worker.
 */
export function shouldShowCandidateAiFinalApprovalIcon(
  status: string | null | undefined
): boolean {
  const normalized = (status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return (
    normalized === "for_approval" ||
    normalized === "approved" ||
    normalized === "converted" ||
    normalized === "active" ||
    normalized === "hired"
  );
}

/**
 * AI icon that opens Final Approval for eligible worker-linked candidates.
 * Hidden unless status is For Approval, Approved, or post-conversion worker.
 */
export function CandidateAiFinalApprovalLink({
  workerId,
  status,
  candidateName,
  className = "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_8%,white)]",
  iconClassName = "h-4 w-4 text-[color:var(--brand-primary)]",
}: CandidateAiFinalApprovalLinkProps) {
  if (!shouldShowCandidateAiFinalApprovalIcon(status)) return null;

  const id = typeof workerId === "string" ? workerId.trim() : "";
  if (!id) return null;

  const label = candidateName?.trim()
    ? `AI review for ${candidateName.trim()}`
    : "Open AI final approval";

  return (
    <Link
      href={candidateFinalApprovalHref(id)}
      className={className}
      aria-label={label}
      title="AI Final Approval"
      onClick={(event) => event.stopPropagation()}
    >
      <Sparkles className={iconClassName} strokeWidth={2} aria-hidden />
    </Link>
  );
}
