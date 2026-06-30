"use client";

import Link from "next/link";

type CandidateDetailResumeFieldProps = {
  label: string;
  attached: boolean;
  resumeHref: string;
};

export default function CandidateDetailResumeField({
  label,
  attached,
  resumeHref,
}: CandidateDetailResumeFieldProps) {
  return (
    <>
      <div className="border-b border-r border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 text-[#374151]">
        {label}
      </div>
      <div className="border-b border-[#E5E7EB] px-5 py-3 text-[14px] font-normal leading-5 break-all text-[#111827]">
        {attached ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[var(--brand-primary)]">Attached</span>
            <Link href={resumeHref} className="text-[var(--brand-primary)] hover:underline">
              View / download
            </Link>
          </div>
        ) : (
          <Link
            href={resumeHref}
            className="inline-flex cursor-pointer items-center gap-1 text-[var(--brand-primary)]"
          >
            <span className="text-base leading-none">+</span>
            <span>Add</span>
          </Link>
        )}
      </div>
    </>
  );
}
