"use client";

import { Check } from "lucide-react";

type BrandedStepperCompleteIconProps = {
  className?: string;
};

/**
 * Completed onboarding step — Figma-style filled circle with inner white ring + check.
 * Uses tenant primary (Brass default tan `#BC8B41`).
 */
export default function BrandedStepperCompleteIcon({
  className = "h-8 w-8",
}: BrandedStepperCompleteIconProps) {
  return (
    <span
      className={`relative z-10 inline-flex shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary,#BC8B41)] ${className}`}
      aria-hidden
    >
      <span className="pointer-events-none absolute inset-[3px] rounded-full border border-white/90" />
      <Check className="relative z-10 h-3.5 w-3.5 text-white" strokeWidth={2.75} />
    </span>
  );
}
