"use client";

import { Loader2 } from "lucide-react";

type DashboardPageLoaderProps = {
  label?: string;
  overlay?: boolean;
  className?: string;
};

export default function DashboardPageLoader({
  label = "Loading...",
  overlay = false,
  className = "",
}: DashboardPageLoaderProps) {
  const content = (
    <div
      className={`flex flex-col items-center gap-3 px-6 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <Loader2 className="h-10 w-10 animate-spin text-[color:var(--brand-primary)]" aria-hidden />
      <p className="text-sm font-medium text-[#475569]">{label}</p>
    </div>
  );

  if (overlay) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[1px]">
        {content}
      </div>
    );
  }

  return (
    <div className={`flex min-h-[420px] w-full items-center justify-center py-16 ${className}`}>
      {content}
    </div>
  );
}
