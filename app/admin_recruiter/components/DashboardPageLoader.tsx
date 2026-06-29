"use client";

import { Loader2 } from "lucide-react";

type DashboardPageLoaderProps = {
  label?: string;
  overlay?: boolean;
  /** Fill the main content area below the worker portal header. */
  layout?: "default" | "page";
  className?: string;
};

export default function DashboardPageLoader({
  label = "Loading...",
  overlay = false,
  layout = "default",
  className = "",
}: DashboardPageLoaderProps) {
  const content = (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-[color:var(--brand-primary)]" aria-hidden />
      <p className="text-sm font-medium text-[#475569]">{label}</p>
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[1px]">
        <div
          className={className}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={label}
        >
          {content}
        </div>
      </div>
    );
  }

  if (layout === "page") {
    return (
      <div
        className={`flex min-h-[calc(100dvh-var(--admin-recruiter-header-height,67px))] w-full flex-1 items-center justify-center ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-[420px] w-full items-center justify-center py-16 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {content}
    </div>
  );
}
