"use client";

import { Loader2 } from "lucide-react";

type CandidateDetailLoaderProps = {
  label?: string;
  className?: string;
};

export default function CandidateDetailLoader({
  label = "Loading...",
  className = "",
}: CandidateDetailLoaderProps) {
  return (
    <div
      className={`flex min-h-[360px] w-full items-center justify-center py-16 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2
          className="h-10 w-10 animate-spin text-[color:var(--brand-primary)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[#475569]">{label}</p>
      </div>
    </div>
  );
}
