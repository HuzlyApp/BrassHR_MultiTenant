"use client";

import { User } from "lucide-react";

type CandidateAvatarIconProps = {
  className?: string;
};

/** Applicant avatar — fixed gray border, tenant accent icon color. */
export default function CandidateAvatarIcon({ className = "" }: CandidateAvatarIconProps) {
  return (
    <span
      className={`inline-flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white p-[10px] ${className}`}
      aria-hidden
    >
      <User className="h-9 w-9" style={{ color: "var(--brand-primary)" }} strokeWidth={2} />
    </span>
  );
}
