"use client";

import { Loader2 } from "lucide-react";

type Props = {
  message?: string;
};

/** Full worker portal session bootstrap — shown once before applicant session is ready. */
export function ApplicantPortalSessionLoader({
  message = "Loading your workspace…",
}: Props) {
  return (
    <div
      className="flex min-h-[calc(100dvh-var(--worker-portal-header-height,64px))] w-full flex-1 items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#64748B]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[#475569]">{message}</p>
      </div>
    </div>
  );
}
