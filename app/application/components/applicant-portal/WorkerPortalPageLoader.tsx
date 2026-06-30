"use client";

import { Loader2 } from "lucide-react";

type Props = {
  label?: string;
  className?: string;
};

/** Centers loading state in the worker portal main area (below header, beside sidebar). */
export function WorkerPortalPageLoader({ label = "Loading...", className = "" }: Props) {
  return (
    <div
      className={`flex min-h-[calc(100dvh-var(--admin-recruiter-header-height,67px))] w-full flex-1 items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--brand-primary)]" aria-hidden />
        <p className="text-sm font-medium text-[#475569]">{label}</p>
      </div>
    </div>
  );
}
