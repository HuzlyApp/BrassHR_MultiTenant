"use client";

import { User } from "lucide-react";

type CandidateAvatarIconProps = {
  className?: string;
};

/** Applicant avatar ring — uses tenant accent from effective-branding CSS vars. */
export default function CandidateAvatarIcon({
  className = "h-[52px] w-[52px]",
}: CandidateAvatarIconProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-white ${className}`}
      style={{ borderColor: "var(--brand-primary)" }}
      aria-hidden
    >
      <User className="h-6 w-6" style={{ color: "var(--brand-primary)" }} strokeWidth={2} />
    </span>
  );
}
